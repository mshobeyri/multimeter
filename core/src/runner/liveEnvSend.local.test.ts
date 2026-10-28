/**
 * File-backed live e: under API Tester Send (requestOverride).
 * Nested type:api targets must mint their own request — not inherit the
 * parent Send snapshot (regression: session_api stayed "{{e:session_api}}").
 */
import * as path from 'path';

import {buildApiTesterSendRequest} from '../api-edit/apiBodyEdit';
import {APIData} from '../data/APIData';
import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';
import {onLocalTestServerRequest} from '../network/localTestServer';
import {
  closeAllHttpConnections,
  setRunnerNetworkConfig,
} from '../network/networkCore';
import {yamlToAPI} from '../parse/apiParsePack';
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
  [`${ROOT}/consume_session_xml.mmt`]: [
    'type: api',
    'title: Echo live sessions as XML',
    `url: ${BASE}/echo/xml`,
    'method: post',
    'format: xml',
    'body:',
    '  body:',
    '    session_api: e:session_api',
    '    note: asda<<e:session_test>>',
  ].join('\n'),
  [`${ROOT}/consume_session_urlencoded.mmt`]: [
    'type: api',
    'title: Echo live sessions as urlencoded',
    `url: ${BASE}/echo`,
    'method: post',
    'format: urlencoded',
    'body:',
    '  session_api: e:session_api',
    '  note: asda<<e:session_test>>',
  ].join('\n'),
  [`${ROOT}/consume_session_text.mmt`]: [
    'type: api',
    'title: Echo live sessions as text',
    `url: ${BASE}/echo`,
    'method: post',
    'format: text',
    'body: "api=<<e:session_api>> test=e:session_test"',
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

  async function runConsumerWithSendFreeze(consumerPath: string): Promise<{
    outcome: Awaited<ReturnType<typeof runFile>>;
    wireBodies: string[];
    sendBody: unknown;
  }> {
    const api = yamlToAPI(FILES[consumerPath]) as APIData;
    const env = {
      session_api: './create_session_api.mmt',
      session_test: './create_session_test.mmt',
    };
    const {sendRequest} = buildApiTesterSendRequest(api, {}, env);
    // Sanity: freeze still contains deferred e: (not yet resolved).
    // JSON/XML/text keep `e:…` / `<<e:…>>`; urlencoded uses `e%3A…`.
    expect(String(sendRequest.body)).toMatch(/e(?::|%3A)session/i);

    const wireBodies: string[] = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.method === 'POST' &&
          (info.path.startsWith('/echo') || info.path.startsWith('/echo/'))) {
        wireBodies.push(info.body);
      }
    });

    try {
      const outcome = await runFile({
        file: FILES[consumerPath],
        fileType: 'raw',
        filePath: consumerPath,
        fileLoader: async (p: string) => {
          const key = path.normalize(p);
          return FILES[key] ?? FILES[p] ?? '';
        },
        envvar: env,
        envvarFilePath: `${ROOT}/multimeter.mmt`,
        jsRunner: (ctx: any) => runJSCode({
          ...ctx,
          requestOverride: ctx.envValueRun ? null : sendRequest,
        }),
        logger: () => undefined,
        reporter: () => undefined,
      } as any);
      return {outcome, wireBodies, sendBody: sendRequest.body};
    } finally {
      stop();
    }
  }

  it('resolves live e: in an XML Send freeze (bare + entity-escaped)',
     async () => {
       const {outcome, wireBodies, sendBody} =
           await runConsumerWithSendFreeze(`${ROOT}/consume_session_xml.mmt`);
       expect(outcome.result.success).toBe(true);
       // Pre-resolve freeze must keep deferred forms that previously broke XML.
       expect(String(sendBody)).toContain('e:session_api');
       expect(String(sendBody)).toMatch(/&lt;&lt;e:session_test&gt;&gt;/);

       const consumerBody = wireBodies[wireBodies.length - 1];
       expect(consumerBody).toMatch(
           /<session_api>[0-9a-f-]{36}<\/session_api>/i);
       expect(consumerBody).toMatch(/<note>asda[0-9a-f-]{36}<\/note>/i);
       expect(consumerBody).not.toContain('e:session_api');
       expect(consumerBody).not.toContain('&lt;&lt;e:');
       expect(consumerBody).not.toContain('<<e:');
     });

  it('resolves live e: in a urlencoded Send freeze', async () => {
    const {outcome, wireBodies, sendBody} = await runConsumerWithSendFreeze(
        `${ROOT}/consume_session_urlencoded.mmt`);
    expect(outcome.result.success).toBe(true);
    expect(String(sendBody)).toMatch(/e%3Asession_api/i);

    const consumerBody = wireBodies[wireBodies.length - 1];
    expect(consumerBody).toMatch(/session_api=[0-9a-f-]{36}/i);
    expect(consumerBody).toMatch(/note=asda[0-9a-f-]{36}/i);
    expect(consumerBody).not.toContain('e%3Asession');
    expect(consumerBody).not.toContain('e:session');
  });

  it('resolves live e: in a text Send freeze', async () => {
    const {outcome, wireBodies, sendBody} =
        await runConsumerWithSendFreeze(`${ROOT}/consume_session_text.mmt`);
    expect(outcome.result.success).toBe(true);
    expect(String(sendBody)).toMatch(/e:session/);

    const consumerBody = wireBodies[wireBodies.length - 1];
    expect(consumerBody).toMatch(/api=[0-9a-f-]{36}/i);
    expect(consumerBody).toMatch(/test=[0-9a-f-]{36}/i);
    expect(consumerBody).not.toContain('e:session');
    expect(consumerBody).not.toContain('<<e:');
  });
});
