/**
 * Body/header token resolution → wire send → local.mmt.dev/echo response.
 * Covers e:, c:, and git c: (branch / commit / commit_short / tag /
 * git_describe / git_dirty), including example expects and UI Send override.
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
  currentValueForToken,
  setGitCurrentSnapshot,
} from '../tokens/Current';
import {runJSCode} from './jsRunner';
import {runFile} from './runner';

const BASE = 'https://local.mmt.dev';

const ENV = {
  service_url: 'https://local.mmt.dev',
  account_age: 42,
  feature_enabled: true,
  plan_code: 10,
  plan_label: '10',
};

const GIT = {
  branch: 'feature/token-test',
  commit: 'a4f5e463',
  commitHash: 'a4f5e4630123456789abcdef0123456789abcdef',
  tag: 'v9.9.9',
  describe: 'v9.9.9-2-ga4f5e463',
  dirty: true,
};

type RunLocalOpts = {
  envvar?: Record<string, any>;
  exampleName?: string;
  requestOverride?: Record<string, unknown>|null;
};

async function runLocalApi(yaml: string, opts: RunLocalOpts = {}) {
  return runFile({
    file: yaml,
    fileType: 'raw',
    filePath: '/tmp/token-resolution.mmt',
    fileLoader: async () => '',
    envvar: opts.envvar || {},
    exampleName: opts.exampleName,
    jsRunner: (ctx: any) => runJSCode({
      ...ctx,
      requestOverride: opts.requestOverride ?? null,
    }),
    logger: () => undefined,
  } as any);
}

function parseEchoBody(outcome: any): any {
  const raw = outcome.result.outputs?._?.body;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

describe('token resolution → local.mmt.dev/echo', () => {
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

  it('resolves e: in a JSON body and echoes typed values', async () => {
    const yaml = [
      'type: api',
      `url: ${BASE}/echo`,
      'method: post',
      'format: json',
      'body:',
      '  account_age: e:account_age',
      '  feature_enabled: e:feature_enabled',
      '  plan_code: e:plan_code',
      '  plan_label: e:plan_label',
      '  service_url: e:service_url',
      '  missing_region: e:region',
      '  literal_token: "e:account_age"',
      '  angle_whole: <<e:account_age>>',
      '  quoted_angle: "<<e:account_age>>"',
      '  angle_prefix: "asda<<e:account_age>>"',
      '  quoted_curly: "{{e:account_age}}"',
      '  curly_whole: "{{e:plan_label}}"',
      '  text_slice: <<e:service_url[0:8]>>',
      '  missing_embed: "x<<e:region>>y"',
      'outputs:',
      '  account_age: body.body.account_age',
      '  feature_enabled: body.body.feature_enabled',
      '  plan_code: body.body.plan_code',
      '  plan_label: body.body.plan_label',
      '  service_url: body.body.service_url',
      '  missing_region: body.body.missing_region',
      '  literal_token: body.body.literal_token',
      '  angle_whole: body.body.angle_whole',
      '  quoted_angle: body.body.quoted_angle',
      '  angle_prefix: body.body.angle_prefix',
      '  quoted_curly: body.body.quoted_curly',
      '  curly_whole: body.body.curly_whole',
      '  text_slice: body.body.text_slice',
      '  missing_embed: body.body.missing_embed',
      '  status_code: status',
      'examples:',
      '  - id: defaults',
      '    title: Check outputs',
      '    expect:',
      '      status_code: 200',
      '      account_age: e:account_age',
      '      feature_enabled: e:feature_enabled',
      '      plan_code: e:plan_code',
      '      plan_label: e:plan_label',
      '      service_url: e:service_url',
      '      missing_region: "e:region"',
      '      literal_token: "e:account_age"',
      '      angle_whole: e:account_age',
      '      quoted_angle: e:account_age',
      '      angle_prefix: "asda42"',
      '      quoted_curly: e:account_age',
      '      curly_whole: e:plan_label',
      '      text_slice: e:service_url[0:8]',
      '      missing_embed: "xe:regiony"',
      '',
    ].join('\n');

    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const outcome = await runLocalApi(yaml, {
        envvar: ENV,
        exampleName: 'defaults',
      });
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);

      const sent = JSON.parse(wire[0].body);
      expect(sent).toEqual({
        account_age: 42,
        feature_enabled: true,
        plan_code: 10,
        plan_label: '10',
        service_url: 'https://local.mmt.dev',
        missing_region: 'e:region',
        literal_token: 'e:account_age',
        angle_whole: 42,
        quoted_angle: 42,
        angle_prefix: 'asda42',
        quoted_curly: 42,
        curly_whole: '10',
        text_slice: 'https://',
        missing_embed: 'xe:regiony',
      });

      const echoed = parseEchoBody(outcome);
      expect(echoed.body).toEqual(sent);

      const apiTest = outcome.result.apiTest;
      expect(apiTest?.hasChecks).toBe(true);
      expect(apiTest?.softFailed).toBe(false);
      expect(apiTest?.items.every((i: any) => i.status === 'passed')).toBe(true);
    } finally {
      stop();
    }
  });

  it('resolves e: in headers and echoes them as text', async () => {
    const yaml = [
      'type: api',
      `url: ${BASE}/echo`,
      'method: get',
      'headers:',
      '  X-Account-Age: e:account_age',
      '  X-Feature: e:feature_enabled',
      '  X-Plan: <<e:plan_label>>',
      '  X-Missing: e:region',
      '  X-Literal: "e:account_age"',
      'outputs:',
      '  account_age: body.headers.x-account-age',
      '  feature: body.headers.x-feature',
      '  plan: body.headers.x-plan',
      '  missing: body.headers.x-missing',
      '  literal: body.headers.x-literal',
      '  status_code: status',
      'examples:',
      '  - id: defaults',
      '    expect:',
      '      status_code: 200',
      '      account_age: e:account_age',
      '      feature: e:feature_enabled',
      '      plan: e:plan_label',
      '      missing: "e:region"',
      '      literal: "e:account_age"',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml, {
      envvar: ENV,
      exampleName: 'defaults',
    });
    expect(outcome.result.success).toBe(true);

    const echoed = parseEchoBody(outcome);
    // In-process local server keeps resolved header value types (text on real HTTP).
    expect(echoed.headers['x-account-age']).toBe(42);
    expect(echoed.headers['x-feature']).toBe(true);
    expect(echoed.headers['x-plan']).toBe('10');
    expect(echoed.headers['x-missing']).toBe('e:region');
    expect(echoed.headers['x-literal']).toBe('e:account_age');

    expect(outcome.result.apiTest?.softFailed).toBe(false);
    expect(outcome.result.apiTest?.items.every((i: any) => i.status === 'passed'))
        .toBe(true);
  });

  it('resolves c: (clock/locale) in a JSON body and echoes them', async () => {
    const day = currentValueForToken('day');
    const city = currentValueForToken('city');

    const yaml = [
      'type: api',
      `url: ${BASE}/echo`,
      'method: post',
      'format: json',
      'body:',
      '  day_name: c:day',
      '  epoch_seconds: c:epoch',
      '  city: c:city',
      '  missing_token: c:not_a_token',
      '  literal_token: "c:day"',
      '  angle_whole: <<c:epoch>>',
      '  quoted_angle: "<<c:day>>"',
      '  angle_prefix: "asda<<c:day>>"',
      '  quoted_curly: "{{c:day}}"',
      '  curly_whole: "{{c:city}}"',
      '  text_slice: <<c:city[0:1]>>',
      'outputs:',
      '  day_name: body.body.day_name',
      '  epoch_seconds: body.body.epoch_seconds',
      '  city: body.body.city',
      '  missing_token: body.body.missing_token',
      '  literal_token: body.body.literal_token',
      '  angle_whole: body.body.angle_whole',
      '  quoted_angle: body.body.quoted_angle',
      '  angle_prefix: body.body.angle_prefix',
      '  quoted_curly: body.body.quoted_curly',
      '  curly_whole: body.body.curly_whole',
      '  text_slice: body.body.text_slice',
      '  status_code: status',
      'examples:',
      '  - id: defaults',
      '    expect:',
      '      status_code: 200',
      '      day_name: c:day',
      '      epoch_seconds: > 1700000000',
      '      city: c:city',
      '      missing_token: "c:not_a_token"',
      '      literal_token: "c:day"',
      '      angle_whole: "> 1700000000"',
      '      quoted_angle: c:day',
      '      quoted_curly: c:day',
      '      curly_whole: c:city',
      '      text_slice: c:city[0:1]',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml, {exampleName: 'defaults'});
    expect(outcome.result.success).toBe(true);

    const echoed = parseEchoBody(outcome);
    expect(echoed.body.day_name).toBe(day);
    expect(echoed.body.city).toBe(city);
    expect(typeof echoed.body.epoch_seconds).toBe('number');
    expect(echoed.body.epoch_seconds).toBeGreaterThan(1_700_000_000);
    expect(echoed.body.angle_whole).toBe(echoed.body.epoch_seconds);
    expect(echoed.body.quoted_angle).toBe(day);
    expect(echoed.body.angle_prefix).toBe(`asda${day}`);
    expect(echoed.body.quoted_curly).toBe(day);
    expect(echoed.body.curly_whole).toBe(city);
    expect(echoed.body.text_slice).toBe(String(city).slice(0, 1));
    expect(echoed.body.missing_token).toBe('c:not_a_token');
    expect(echoed.body.literal_token).toBe('c:day');

    expect(outcome.result.apiTest?.softFailed).toBe(false);
    expect(outcome.result.apiTest?.items.every((i: any) => i.status === 'passed'))
        .toBe(true);
  });

  it('resolves git c: in a JSON body and echoes the injected snapshot', async () => {
    const yaml = [
      'type: api',
      `url: ${BASE}/echo`,
      'method: post',
      'format: json',
      'body:',
      '  git_branch: c:branch',
      '  git_commit: c:commit',
      '  git_commit_short: c:commit_short',
      '  git_tag: c:tag',
      '  git_describe: c:git_describe',
      '  git_dirty: c:git_dirty',
      '  angle_branch: <<c:branch>>',
      '  quoted_commit: "{{c:commit_short}}"',
      '  embed_tag: "tag=<<c:tag>>"',
      'outputs:',
      '  git_branch: body.body.git_branch',
      '  git_commit: body.body.git_commit',
      '  git_commit_short: body.body.git_commit_short',
      '  git_tag: body.body.git_tag',
      '  git_describe: body.body.git_describe',
      '  git_dirty: body.body.git_dirty',
      '  angle_branch: body.body.angle_branch',
      '  quoted_commit: body.body.quoted_commit',
      '  embed_tag: body.body.embed_tag',
      '  status_code: status',
      'examples:',
      '  - id: defaults',
      '    expect:',
      '      status_code: 200',
      '      git_branch: c:branch',
      '      git_commit: c:commit',
      '      git_commit_short: c:commit_short',
      '      git_tag: c:tag',
      '      git_describe: c:git_describe',
      '      git_dirty: c:git_dirty',
      '      angle_branch: c:branch',
      '      quoted_commit: c:commit_short',
      '      embed_tag: "tag=v9.9.9"',
      '',
    ].join('\n');

    const wire: Array<{body: string}> = [];
    const stop = onLocalTestServerRequest((info) => {
      if (info.path.startsWith('/echo')) {
        wire.push({body: info.body});
      }
    });

    try {
      const outcome = await runLocalApi(yaml, {exampleName: 'defaults'});
      expect(outcome.result.success).toBe(true);
      expect(wire).toHaveLength(1);

      const sent = JSON.parse(wire[0].body);
      expect(sent).toEqual({
        git_branch: GIT.branch,
        git_commit: GIT.commitHash,
        git_commit_short: GIT.commit,
        git_tag: GIT.tag,
        git_describe: GIT.describe,
        git_dirty: true,
        angle_branch: GIT.branch,
        quoted_commit: GIT.commit,
        embed_tag: `tag=${GIT.tag}`,
      });

      const echoed = parseEchoBody(outcome);
      expect(echoed.body).toEqual(sent);

      expect(outcome.result.outputs?.git_branch).toBe(GIT.branch);
      expect(outcome.result.outputs?.git_commit).toBe(GIT.commitHash);
      expect(outcome.result.outputs?.git_commit_short).toBe(GIT.commit);
      expect(outcome.result.outputs?.git_dirty).toBe(true);

      expect(outcome.result.apiTest?.softFailed).toBe(false);
      expect(outcome.result.apiTest?.items.every((i: any) => i.status === 'passed'))
          .toBe(true);
    } finally {
      stop();
    }
  });

  it('resolves git c: in headers and echoes them as text', async () => {
    const yaml = [
      'type: api',
      `url: ${BASE}/echo`,
      'method: get',
      'headers:',
      '  X-Git-Branch: c:branch',
      '  X-Git-Commit: c:commit',
      '  X-Git-Commit-Short: c:commit_short',
      '  X-Git-Tag: c:tag',
      '  X-Git-Describe: c:git_describe',
      '  X-Git-Dirty: c:git_dirty',
      'outputs:',
      '  git_branch: body.headers.x-git-branch',
      '  git_commit: body.headers.x-git-commit',
      '  git_commit_short: body.headers.x-git-commit-short',
      '  git_tag: body.headers.x-git-tag',
      '  git_describe: body.headers.x-git-describe',
      '  git_dirty: body.headers.x-git-dirty',
      '  status_code: status',
      'examples:',
      '  - id: defaults',
      '    expect:',
      '      status_code: 200',
      '      git_branch: c:branch',
      '      git_commit: c:commit',
      '      git_commit_short: c:commit_short',
      '      git_tag: c:tag',
      '      git_describe: c:git_describe',
      '      git_dirty: c:git_dirty',
      '',
    ].join('\n');

    const outcome = await runLocalApi(yaml, {exampleName: 'defaults'});
    expect(outcome.result.success).toBe(true);

    const echoed = parseEchoBody(outcome);
    expect(echoed.headers['x-git-branch']).toBe(GIT.branch);
    expect(echoed.headers['x-git-commit']).toBe(GIT.commitHash);
    expect(echoed.headers['x-git-commit-short']).toBe(GIT.commit);
    expect(echoed.headers['x-git-tag']).toBe(GIT.tag);
    expect(echoed.headers['x-git-describe']).toBe(GIT.describe);
    expect(echoed.headers['x-git-dirty']).toBe(true);

    expect(outcome.result.apiTest?.softFailed).toBe(false);
    expect(outcome.result.apiTest?.items.every((i: any) => i.status === 'passed'))
        .toBe(true);
  });

  it('Send override freezes c:/git c:; deferred e: in the snapshot still resolve',
     async () => {
       const yaml = [
         'type: api',
         `url: ${BASE}/echo`,
         'method: post',
         'format: json',
         'body:',
         '  account_age: e:account_age',
         '  git_branch: c:branch',
         '  git_commit_short: c:commit_short',
         'outputs:',
         '  account_age: body.body.account_age',
         '  git_branch: body.body.git_branch',
         '  git_commit_short: body.body.git_commit_short',
         '  status_code: status',
         'examples:',
         '  - id: defaults',
         '    expect:',
         '      status_code: 200',
         '      account_age: e:account_age',
         '      git_branch: "frozen-branch"',
         '      git_commit_short: "deadbeef"',
         '',
       ].join('\n');

       // UI Send freezes r:/c:. Live e: may remain as whole-field tokens until
       // resolveDeferredEnvTokens_ (structured body walks bare e:).
       const override = {
         url: `${BASE}/echo`,
         protocol: 'http',
         method: 'post',
         headers: {
           'Content-Type': 'application/json',
           'X-Age': 'e:account_age',
         },
         body: {
           account_age: 'e:account_age',
           git_branch: 'frozen-branch',
           git_commit_short: 'deadbeef',
         },
       };

       const wire: Array<{body: string; headers: Record<string, string>}> = [];
       const stop = onLocalTestServerRequest((info) => {
         if (info.path.startsWith('/echo')) {
           wire.push({body: info.body, headers: info.headers});
         }
       });

       try {
         const outcome = await runLocalApi(yaml, {
           envvar: ENV,
           exampleName: 'defaults',
           requestOverride: override,
         });
         expect(outcome.result.success).toBe(true);
         expect(wire).toHaveLength(1);

         const sent = JSON.parse(wire[0].body);
         expect(sent.account_age).toBe(42);
         expect(sent.git_branch).toBe('frozen-branch');
         expect(sent.git_commit_short).toBe('deadbeef');
         expect(wire[0].headers['x-age']).toBe(42);

         const echoed = parseEchoBody(outcome);
         expect(echoed.body).toEqual(sent);

         expect(outcome.result.apiTest?.softFailed).toBe(false);
         expect(outcome.result.apiTest?.items.every(
                    (i: any) => i.status === 'passed'))
             .toBe(true);
       } finally {
         stop();
       }
     });
});
