/**
 * Every `c:` token (generators + future/past aliases) resolved through real
 * api / test / suite runs against in-process `https://local.mmt.dev/echo`.
 * Guards the regression where unsigned alias args leaked as a literal postfix
 * (e.g. `2026-01-01T00:00:00Z(65)` from `c:utc_datetime_future(65)`).
 */
import {DEFAULT_NETWORK_CONFIG} from '../data/NetworkData';
import {onLocalTestServerRequest} from '../network/localTestServer';
import {
  closeAllHttpConnections,
  setRunnerNetworkConfig,
} from '../network/networkCore';
import {
  clearGitCurrentSnapshot,
  clearGitCurrentSnapshotProvider,
  CURRENT_FUTURE_PAST_ALIASES,
  CURRENT_TOKEN_MAP,
  currentValueForToken,
  setGitCurrentSnapshot,
} from '../tokens/Current';
import {createSuiteBundle} from '../suite/suiteBundle';
import {buildSuiteHierarchyFromSuiteFile} from '../suite/suiteHierarchy';
import {runJSCode} from './jsRunner';
import {runFile} from './runner';

const BASE = 'https://local.mmt.dev';
const ROOT = '/tmp/mmt-current-tokens-local';

const GIT = {
  branch: 'feature/c-tokens',
  commit: 'c0ffee12',
  commitHash: 'c0ffee120123456789abcdef0123456789abcdef',
  tag: 'v0.0.1',
  describe: 'v0.0.1-1-gc0ffee12',
  dirty: false,
};

/** Body field name safe for YAML + JSON (alias args use `_`). */
function fieldName(spec: string): string {
  return spec.replace(/[^A-Za-z0-9]+/g, '_');
}

function allCurrentSpecs(): string[] {
  const specs: string[] = [];
  for (const name of Object.keys(CURRENT_TOKEN_MAP)) {
    specs.push(name);
  }
  for (const name of Object.keys(CURRENT_FUTURE_PAST_ALIASES)) {
    specs.push(`${name}(1h)`);
    specs.push(`${name}(65)`);
  }
  // Signed offsets on base temporal tokens.
  specs.push('date(+7d)', 'datetime(-1h)', 'utc_datetime(+1h1m)', 'epoch(+30m)');
  return specs;
}

function buildApiYaml(specs: string[]): string {
  const bodyLines = specs.map((spec) => `  ${fieldName(spec)}: c:${spec}`);
  const embedLines = [
    '  embed_future: "ts=<<c:utc_datetime_future(65s)>>"',
    '  embed_past: "ts=<<c:utc_datetime_past(1h)>>"',
    '  embed_signed: "ts=<<c:utc_datetime(+1h)>>"',
  ];
  const outputLines = [
    ...specs.map((spec) => `  ${fieldName(spec)}: body.body.${fieldName(spec)}`),
    '  embed_future: body.body.embed_future',
    '  embed_past: body.body.embed_past',
    '  embed_signed: body.body.embed_signed',
    '  status_code: status',
  ];
  return [
    'type: api',
    'title: Current tokens echo',
    `url: ${BASE}/echo`,
    'method: post',
    'format: json',
    'body:',
    ...bodyLines,
    ...embedLines,
    'outputs:',
    ...outputLines,
    '',
  ].join('\n');
}

function buildTestYaml(): string {
  return [
    'type: test',
    'title: Current tokens via call',
    'import:',
    '  echo: ./current_api.mmt',
    'steps:',
    '  - call: echo',
    '    id: result',
    '    expect:',
    '      status_code: 200',
    '      embed_future: =* "ts="',
    '      embed_past: =* "ts="',
    '      embed_signed: =* "ts="',
    '',
  ].join('\n');
}

function buildSuiteYaml(): string {
  return [
    'type: suite',
    'title: Current tokens suite',
    'items:',
    '  - ./current_test.mmt',
    '',
  ].join('\n');
}

function assertNoArgPostfix(sent: Record<string, unknown>, specs: string[]) {
  for (const spec of specs) {
    const key = fieldName(spec);
    const value = sent[key];
    expect(value).not.toBeUndefined();
    const text = String(value);
    // Resolved values must not keep the token's `(…)` argument glued on.
    if (/\([^)]*\)$/.test(spec)) {
      const arg = spec.slice(spec.indexOf('('));
      expect(text.endsWith(arg)).toBe(false);
    }
    expect(text).not.toMatch(/\(1h\)$/);
    expect(text).not.toMatch(/\(65\)$/);
    expect(text).not.toMatch(/\(65s\)$/);
    expect(text).not.toMatch(/\(\+1h\)$/);
    expect(text).not.toMatch(/\(\+7d\)$/);
    expect(text).not.toMatch(/\(-1h\)$/);
    expect(text).not.toMatch(/\(\+1h1m\)$/);
    expect(text).not.toMatch(/\(\+30m\)$/);
  }

  expect(String(sent.embed_future)).toMatch(/^ts=/);
  expect(String(sent.embed_future)).not.toMatch(/\(65s\)/);
  expect(String(sent.embed_past)).toMatch(/^ts=/);
  expect(String(sent.embed_past)).not.toMatch(/\(1h\)/);
  expect(String(sent.embed_signed)).toMatch(/^ts=/);
  expect(String(sent.embed_signed)).not.toMatch(/\(\+1h\)/);
}

function assertResolvedShapes(sent: Record<string, unknown>) {
  // Spot-check a few known shapes against currentValueForToken.
  expect(sent[fieldName('day')]).toBe(currentValueForToken('day'));
  expect(sent[fieldName('branch')]).toBe(GIT.branch);
  expect(sent[fieldName('commit_short')]).toBe(GIT.commit);
  expect(sent[fieldName('git_dirty')]).toBe(false);
  expect(typeof sent[fieldName('epoch')]).toBe('number');
  expect(typeof sent[fieldName('epoch_future_1h_')]).toBe('number');
  expect(String(sent[fieldName('utc_datetime')])).toMatch(/Z$/);
  expect(String(sent[fieldName('utc_datetime_future_1h_')])).toMatch(/Z$/);
  expect(String(sent[fieldName('utc_datetime_future_65_')])).toMatch(/Z$/);
}

async function runLocal(yaml: string, opts: {
  filePath: string,
  fileLoader: (p: string) => Promise<string>,
  suiteBundle?: any,
} ) {
  return runFile({
    file: yaml,
    fileType: 'raw',
    filePath: opts.filePath,
    fileLoader: opts.fileLoader,
    envvar: {},
    suiteBundle: opts.suiteBundle,
    jsRunner: (ctx: any) => runJSCode(ctx),
    logger: () => undefined,
    reporter: () => undefined,
  } as any);
}

describe('c: tokens → local.mmt.dev (api / test / suite)', () => {
  const specs = allCurrentSpecs();
  const files: Record<string, string> = {
    [`${ROOT}/current_api.mmt`]: buildApiYaml(specs),
    [`${ROOT}/current_test.mmt`]: buildTestYaml(),
    [`${ROOT}/current_suite.mmt`]: buildSuiteYaml(),
  };

  const fileLoader = async (requested: string) => {
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
  };

  beforeEach(() => {
    setRunnerNetworkConfig(DEFAULT_NETWORK_CONFIG);
    clearGitCurrentSnapshot();
    clearGitCurrentSnapshotProvider();
    setGitCurrentSnapshot(GIT);
  });

  afterEach(() => {
    clearGitCurrentSnapshot();
    clearGitCurrentSnapshotProvider();
    closeAllHttpConnections();
  });

  it('api: resolves every c: token without arg postfix on the wire', async () => {
    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const outcome = await runLocal(files[`${ROOT}/current_api.mmt`], {
        filePath: `${ROOT}/current_api.mmt`,
        fileLoader,
      });
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);

      const sent = JSON.parse(wire[0].body) as Record<string, unknown>;
      assertNoArgPostfix(sent, specs);
      assertResolvedShapes(sent);

      // Unknown / invalid arg forms stay whole tokens (no clock+postfix).
      expect(outcome.result.outputs?._?.status).toBe(200);
    } finally {
      stop();
    }
  });

  it('test: call → api resolves the same c: body against echo', async () => {
    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const outcome = await runLocal(files[`${ROOT}/current_test.mmt`], {
        filePath: `${ROOT}/current_test.mmt`,
        fileLoader,
      });
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);

      const sent = JSON.parse(wire[0].body) as Record<string, unknown>;
      assertNoArgPostfix(sent, specs);
      assertResolvedShapes(sent);
    } finally {
      stop();
    }
  });

  it('suite: runs the test child and keeps c: args off the wire', async () => {
    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const suitePath = `${ROOT}/current_suite.mmt`;
      const tree = await buildSuiteHierarchyFromSuiteFile({
        suiteFilePath: suitePath,
        suiteRawText: files[suitePath],
        fileLoader,
      });
      const bundle = createSuiteBundle({
        rootSuitePath: suitePath,
        hierarchy: tree,
      });

      const outcome = await runLocal(files[suitePath], {
        filePath: suitePath,
        fileLoader,
        suiteBundle: bundle,
      });
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);

      const sent = JSON.parse(wire[0].body) as Record<string, unknown>;
      assertNoArgPostfix(sent, specs);
      assertResolvedShapes(sent);
    } finally {
      stop();
    }
  });
});
