/**
 * File-backed live e: under API Tester Send (requestOverride).
 * Nested type:api targets must mint their own request — not inherit the
 * parent Send snapshot (regression: session_api stayed "{{e:session_api}}").
 */
import * as path from 'path';

import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';
import {onLocalTestServerRequest} from '../network/localTestServer';
import {
  closeAllHttpConnections,
  setRunnerNetworkConfig,
} from '../network/networkCore';
import {runJSCode} from './jsRunner';
import {runFile} from './runner';

const BASE = 'https://local.mmt.dev';
const ROOT = '/tmp/mmt-live-env-send';

const FILES: Record<string, string> = {
  [`${ROOT}/multimeter.mmt`]: [
    'type: env',
    'variables:',
    '  session_api: ./create_session_api.mmt',
    '  session_test: ./create_session_test.mmt',
  ].join('\n'),
  [`${ROOT}/create_session_api.mmt`]: [
    'type: api',
    'title: Create session (API)',
    'outputs:',
    '  session: body.body.uuid',
    `url: ${BASE}/echo`,
    'method: post',
    'format: json',
    'body:',
    '  uuid: r:uuid',
  ].join('\n'),
  [`${ROOT}/create_session_test.mmt`]: [
    'type: test',
    'title: Create session (test)',
    'outputs:',
    '  session: \'\'',
    'cache: 2s',
    'steps:',
    '  - set:',
    '      o:session: r:uuid',
  ].join('\n'),
  [`${ROOT}/consume_session_api.mmt`]: [
    'type: api',
    'title: Echo both live sessions',
    `url: ${BASE}/echo`,
    'method: post',
    'format: json',
    'body:',
    '  session_api: e:session_api',
    '  session_test: e:session_test',
  ].join('\n'),
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('live e: under Send requestOverride → local.mmt.dev/echo', () => {
  beforeEach(() => {
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
  });

  afterEach(() => {
    closeAllHttpConnections();
  });

  it('resolves both file-backed e: tokens when Send freezes the body', async () => {
    const consumerPath = `${ROOT}/consume_session_api.mmt`;
    // Same shape the API tester posts after mint (display {{e:}} still deferred).
    const requestOverride = {
      url: `${BASE}/echo`,
      protocol: 'http',
      method: 'post',
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: JSON.stringify({
        session_api: '{{e:session_api}}',
        session_test: '{{e:session_test}}',
      }),
    };

    const wireBodies: string[] = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo') && info.method === 'POST') {
        wireBodies.push(info.body);
      }
    });

    try {
      // Mimic the extension host: always close over Send's requestOverride.
      // Nested create_session_api must still clear it via envValueRun.
      const outcome = await runFile({
        file: FILES[consumerPath],
        fileType: 'raw',
        filePath: consumerPath,
        fileLoader: async (p: string) => {
          const key = path.normalize(p);
          return FILES[key] ?? FILES[p] ?? '';
        },
        envvar: {
          session_api: './create_session_api.mmt',
          session_test: './create_session_test.mmt',
        },
        envvarFilePath: `${ROOT}/multimeter.mmt`,
        jsRunner: (ctx: any) => runJSCode({
          ...ctx,
          requestOverride: ctx.envValueRun ? null : requestOverride,
        }),
        logger: () => undefined,
        reporter: () => undefined,
      } as any);

      expect(outcome.result.success).toBe(true);
      // create_session_api POST + consumer POST
      expect(wireBodies.length).toBeGreaterThanOrEqual(2);

      const consumerBody = JSON.parse(wireBodies[wireBodies.length - 1]);
      expect(consumerBody.session_api).toMatch(UUID_RE);
      expect(consumerBody.session_test).toMatch(UUID_RE);
      expect(consumerBody.session_api).not.toContain('e:session_api');
      expect(consumerBody.session_test).not.toContain('e:session_test');

      const createBody = JSON.parse(wireBodies[0]);
      expect(createBody.uuid).toMatch(UUID_RE);
      expect(createBody.uuid).toBe(consumerBody.session_api);
    } finally {
      stop();
    }
  });

  it('still clears override when the host always re-applies Send snapshot',
     async () => {
       const consumerPath = `${ROOT}/consume_session_api.mmt`;
       const requestOverride = {
         url: `${BASE}/echo`,
         protocol: 'http',
         method: 'post',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({
           session_api: '{{e:session_api}}',
           session_test: '{{e:session_test}}',
         }),
       };

       const wireBodies: string[] = [];
       const stop = onLocalTestServerRequest((info) => {
         if (info.path.startsWith('/echo') && info.method === 'POST') {
           wireBodies.push(info.body);
         }
       });

       try {
         // Host bug pattern: requestOverride after spread always wins.
         // envValueRun on ctx must still force a clear inside runJSCode.
         const outcome = await runFile({
           file: FILES[consumerPath],
           fileType: 'raw',
           filePath: consumerPath,
           fileLoader: async (p: string) => {
             const key = path.normalize(p);
             return FILES[key] ?? FILES[p] ?? '';
           },
           envvar: {
             session_api: './create_session_api.mmt',
             session_test: './create_session_test.mmt',
           },
           envvarFilePath: `${ROOT}/multimeter.mmt`,
           jsRunner: (ctx: any) => runJSCode({
             ...ctx,
             requestOverride,
           }),
           logger: () => undefined,
           reporter: () => undefined,
         } as any);

         expect(outcome.result.success).toBe(true);
         const consumerBody = JSON.parse(wireBodies[wireBodies.length - 1]);
         expect(consumerBody.session_api).toMatch(UUID_RE);
         expect(consumerBody.session_test).toMatch(UUID_RE);
         expect(String(consumerBody.session_api))
             .not.toContain('{{e:session_api}}');
       } finally {
         stop();
       }
     });
});
