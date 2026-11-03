/**
 * Runtime coverage: step fields that take scalars must resolve e: / i: tokens
 * (regression: `delay: e:delay` was parsed as the literal string "e:delay" → 0ms).
 */
import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';
import {
  closeAllHttpConnections,
  setRunnerNetworkConfig,
} from '../network/networkCore';
import {onLocalTestServerRequest} from '../network/localTestServer';
import {runJSCode} from './jsRunner';
import {runFile} from './runner';

const BASE = 'https://local.mmt.dev';
const ROOT = '/tmp/mmt-step-tokens';

async function runTestYaml(
    yaml: string,
    opts: {
      envvar?: Record<string, any>,
      manualInputs?: Record<string, any>,
      fileLoader?: (p: string) => Promise<string>,
    } = {},
) {
  return runFile({
    file: yaml,
    fileType: 'raw',
    filePath: `${ROOT}/test.mmt`,
    fileLoader: opts.fileLoader || (async () => ''),
    envvar: opts.envvar || {},
    manualInputs: opts.manualInputs || {},
    jsRunner: (ctx: any) => runJSCode(ctx),
    logger: () => undefined,
    reporter: () => undefined,
  } as any);
}

describe('step fields resolve e: / i: at runtime', () => {
  beforeEach(() => {
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
  });

  afterEach(() => {
    closeAllHttpConnections();
  });

  it('delay: e:delay and delay: i:wait actually wait', async () => {
    const yaml = [
      'type: test',
      'title: delay tokens',
      'inputs:',
      '  wait: 40ms',
      'steps:',
      '  - delay: e:pause',
      '  - delay: i:wait',
      '  - print: done',
      '',
    ].join('\n');

    const started = Date.now();
    const outcome = await runTestYaml(yaml, {
      envvar: {pause: '40ms'},
      manualInputs: {wait: '40ms'},
    });
    const elapsed = Date.now() - started;

    expect(outcome.result.success).toBe(true);
    // Two ~40ms delays; allow some scheduling slack but require real waiting
    // (the bug sent 0ms and finished in well under 20ms).
    expect(elapsed).toBeGreaterThanOrEqual(60);
  });

  it('repeat: e:times / i:times runs the body N times', async () => {
    const yaml = [
      'type: test',
      'title: repeat tokens',
      'inputs:',
      '  times: 2',
      'steps:',
      '  - let:',
      '      hits: 0',
      '  - repeat: e:outer',
      '    steps:',
      '      - js: hits = hits + 1',
      '  - repeat: i:times',
      '    steps:',
      '      - js: hits = hits + 1',
      '  - assert: ${hits} == 5',
      '',
    ].join('\n');

    const outcome = await runTestYaml(yaml, {
      envvar: {outer: 3},
      manualInputs: {times: 2},
    });
    expect(outcome.result.success).toBe(true);
  });

  it('print / const / let / set / setenv / check / if resolve e: and i:', async () => {
    const yaml = [
      'type: test',
      'title: scalar step tokens',
      'inputs:',
      '  who: world',
      '  flag: true',
      'steps:',
      '  - const:',
      '      greeting: e:hello',
      '  - let:',
      '      target: i:who',
      '  - set:',
      '      combined: "<<e:hello>>-<<i:who>>"',
      '  - setenv:',
      '      from_input: i:who',
      '  - print: "<<e:hello>> <<i:who>>"',
      '  - check: ${greeting} == e:hello',
      '  - check: ${target} == i:who',
      '  - check: ${combined} == "hi-world"',
      '  - check: e:from_input == "world"',
      '  - if: i:flag == true',
      '    steps:',
      '      - print: flagged',
      '',
    ].join('\n');

    const outcome = await runTestYaml(yaml, {
      envvar: {hello: 'hi'},
      manualInputs: {who: 'world', flag: true},
    });
    expect(outcome.result.success).toBe(true);
  });

  it('call inputs and http body accept e: / i: against local.mmt.dev', async () => {
    const files: Record<string, string> = {
      [`${ROOT}/echo_api.mmt`]: [
        'type: api',
        `url: ${BASE}/echo`,
        'method: post',
        'format: json',
        'inputs:',
        '  label: x',
        'body:',
        '  label: i:label',
        'outputs:',
        '  label: body.body.label',
        '  status_code: status',
        '',
      ].join('\n'),
      [`${ROOT}/test.mmt`]: [
        'type: test',
        'title: call/http tokens',
        'import:',
        '  echo: ./echo_api.mmt',
        'inputs:',
        '  label: from-input',
        'steps:',
        '  - call: echo',
        '    inputs:',
        '      label: e:label',
        '    expect:',
        '      status_code: 200',
        '      label: e:label',
        '  - call: echo',
        '    inputs:',
        '      label: i:label',
        '    expect:',
        '      status_code: 200',
        '      label: i:label',
        '  - http: ' + BASE + '/echo',
        '    method: post',
        '    format: json',
        '    body:',
        '      via_env: e:label',
        '      via_input: i:label',
        '    expect:',
        '      status: 200',
        '',
      ].join('\n'),
    };

    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const outcome = await runFile({
        file: files[`${ROOT}/test.mmt`],
        fileType: 'raw',
        filePath: `${ROOT}/test.mmt`,
        fileLoader: async (requested: string) => {
          const normalized = requested.startsWith('/') ?
              requested :
              `${ROOT}/${requested.replace(/^\.\//, '')}`;
          if (files[normalized] !== undefined) {
            return files[normalized];
          }
          const base = normalized.split('/').pop() || '';
          for (const [path, body] of Object.entries(files)) {
            if (path.endsWith(`/${base}`)) {
              return body;
            }
          }
          return '';
        },
        envvar: {label: 'from-env'},
        manualInputs: {label: 'from-input'},
        jsRunner: (ctx: any) => runJSCode(ctx),
        logger: () => undefined,
        reporter: () => undefined,
      } as any);

      expect(outcome.result.success).toBe(true);
      expect(wire.length).toBe(3);
      expect(JSON.parse(wire[0].body)).toEqual({label: 'from-env'});
      expect(JSON.parse(wire[1].body)).toEqual({label: 'from-input'});
      expect(JSON.parse(wire[2].body)).toEqual({
        via_env: 'from-env',
        via_input: 'from-input',
      });
    } finally {
      stop();
    }
  });
});
