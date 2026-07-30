import {runFile} from './runner';
import {runJSCode} from './jsRunner';
import {createReportCollector} from './reportCollector';
import {generateReportMarkdown, generateReportMarkdownDetailed} from './reportMarkdown';
import {generateJunitXml} from './junitXml';
import {generateMmtReport} from './mmtReport';
import {generateReportHtml} from './reportHtml';
import {OMIT_SENTINEL} from './omitKeyword';

jest.mock('./networkCoreNode', () => {
  const sentRequests: any[] = [];
  return {
    sentRequests,
    send: jest.fn(async (req: any) => {
      sentRequests.push(JSON.parse(JSON.stringify(req)));
      let body: any = {};
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      } catch {
        body = {};
      }
      return {
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({
          echoed: body,
          nested: {inner: {value: 'present'}},
        }),
        headers: {'content-type': 'application/json'},
        duration: 11,
      };
    }),
    setRunnerNetworkConfig: jest.fn(),
    getRunnerNetworkConfig: jest.fn(() => ({})),
  };
});

const sentRequests =
    (require('./networkCoreNode') as any).sentRequests as any[];

function assertNoOmitSentinel(...texts: string[]) {
  for (const text of texts) {
    expect(text).not.toContain(OMIT_SENTINEL);
    expect(text).not.toContain('__MMT_OMIT_KEYWORD__');
  }
}

async function runWithCollector(
    files: Record<string, string>,
    entry: string,
    options?: {filePath?: string},
) {
  const collector = createReportCollector();
  const filePath = options?.filePath || `/project/${entry}`;
  const result = await runFile({
    file: files[entry],
    filePath,
    fileType: 'raw',
    fileLoader: async (requested: string) => {
      const name = String(requested).split('/').pop() || '';
      if (files[name] !== undefined) {
        return files[name];
      }
      const normalized = requested.startsWith('/') ? requested : `/project/${requested.replace(/^\.\//, '')}`;
      const byPath = Object.entries(files).find(([k]) =>
        normalized.endsWith(k) || k.endsWith(name));
      return byPath ? byPath[1] : '';
    },
    jsRunner: (context: any) => runJSCode(context),
    logger: () => undefined,
    reporter: collector.reporter,
  } as any);
  return {result, collected: collector.getResults()};
}

function allReportTexts(collected: ReturnType<ReturnType<typeof createReportCollector>['getResults']>) {
  return {
    md: generateReportMarkdown(collected),
    mdDetailed: generateReportMarkdownDetailed(collected),
    junit: generateJunitXml(collected),
    mmt: generateMmtReport(collected),
    html: generateReportHtml(collected),
  };
}

describe('report levels that should be triggered', () => {
  it('report: all emits both passes and failures', async () => {
    const {collected} = await runWithCollector(
        {
          'levels.mmt': `type: test
title: levels all
steps:
  - check:
      actual: "1"
      expected: "1"
      operator: ==
      report: all
  - check:
      actual: "1"
      expected: "2"
      operator: ==
      report: all
`,
        },
        'levels.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps).toHaveLength(2);
    expect(steps.filter(s => s.status === 'passed')).toHaveLength(1);
    expect(steps.filter(s => s.status === 'failed')).toHaveLength(1);

    const {md, junit, mmt, html} = allReportTexts(collected);
    expect(md).toContain('1 passed, 1 failed, 2 total checks');
    expect(junit).toContain('failures="1"');
    expect(mmt).toContain('result: passed');
    expect(mmt).toContain('result: failed');
    expect(html).toContain('1 failed');
  });

  it('report: fails emits only failures', async () => {
    const {collected} = await runWithCollector(
        {
          'fails.mmt': `type: test
title: levels fails
steps:
  - check:
      actual: "1"
      expected: "1"
      operator: ==
      report: fails
  - check:
      actual: "1"
      expected: "2"
      operator: ==
      report: fails
`,
        },
        'fails.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe('failed');
    expect(generateReportMarkdown(collected)).toContain('0 passed, 1 failed, 1 total checks');
  });

  it('report: none emits nothing even for failures', async () => {
    const {collected} = await runWithCollector(
        {
          'silent.mmt': `type: test
title: levels none
steps:
  - check:
      actual: "1"
      expected: "1"
      operator: ==
      report: none
  - check:
      actual: "1"
      expected: "2"
      operator: ==
      report: none
`,
        },
        'silent.mmt');

    expect(collected.testRuns.flatMap(r => r.steps)).toHaveLength(0);
    expect(generateReportMarkdown(collected)).toContain('0 passed, 0 failed, 0 total checks');
  });

  it('call expect report:none suppresses the expect event', async () => {
    const {collected} = await runWithCollector(
        {
          'echo_api.mmt': `type: api
url: https://example.com/echo
method: post
body:
  ok: true
outputs:
  ok: body.echoed.ok
`,
          'silent_expect.mmt': `type: test
title: silent expect
import:
  echo: ./echo_api.mmt
steps:
  - call: echo
    title: hidden
    expect:
      status: 200
      ok: true
    report: none
  - check:
      actual: "1"
      expected: "1"
      operator: ==
      report: all
`,
        },
        'silent_expect.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps).toHaveLength(1);
    expect(steps[0].expects?.[0]?.comparison).toContain('1 == 1');
  });

  it('default internal reports all checks when running a test directly', async () => {
    const {collected} = await runWithCollector(
        {
          'defaults.mmt': `type: test
title: defaults
steps:
  - check: 1 == 1
  - check: 2 == 3
`,
        },
        'defaults.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps).toHaveLength(2);
    expect(steps.map(s => s.status).sort()).toEqual(['failed', 'passed']);
  });

  it('imported child uses external:fails so only child failures are reported', async () => {
    const {collected} = await runWithCollector(
        {
          'child.mmt': `type: test
title: child
steps:
  - check: 1 == 1
  - check: 1 == 2
`,
          'parent.mmt': `type: test
title: parent
import:
  child: ./child.mmt
steps:
  - call: child
  - check: 9 == 9
`,
        },
        'parent.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    // Child pass suppressed (external:fails); child fail reported; parent pass reported.
    expect(steps).toHaveLength(2);
    expect(steps.filter(s => s.status === 'failed')).toHaveLength(1);
    expect(steps.filter(s => s.status === 'passed')).toHaveLength(1);

    const comparisons = steps.flatMap(s => (s.expects || []).map(e => e.comparison)).join(' | ');
    expect(comparisons).toContain('1 == 2');
    expect(comparisons).toContain('9 == 9');
    expect(comparisons).not.toMatch(/(^|\|)\s*1 == 1(\s|$|\|)/);
  });

  it('object-form report.external:all reports child passes when imported', async () => {
    const {collected} = await runWithCollector(
        {
          'child-all.mmt': `type: test
title: child all
steps:
  - check:
      actual: "1"
      expected: "1"
      operator: ==
      report:
        internal: all
        external: all
`,
          'parent-all.mmt': `type: test
title: parent all
import:
  child: ./child-all.mmt
steps:
  - call: child
`,
        },
        'parent-all.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe('passed');
  });
});

describe('omit and different inputs across report formats', () => {
  beforeEach(() => {
    sentRequests.length = 0;
  });

  const NESTED_API = `type: api
url: https://example.com/users
method: post
inputs:
  email: user@example.com
  nickname: nick
  token: secret
headers:
  Authorization: Bearer <<i:token>>
  X-Email: <<i:email>>
body:
  user:
    email: i:email
    profile:
      nickname: i:nickname
      keep: yes
  meta:
    source: test
outputs:
  email: body.echoed.user.email
  nickname: body.echoed.user.profile.nickname
  missing: body.echoed.user.profile.absent
  nestedValue: body.nested.inner.value
`;

  it('omitted inputs are removed from sent request and from md-detailed request body', async () => {
    const {collected, result} = await runWithCollector(
        {
          'nested_api.mmt': NESTED_API,
          'omit_inputs.mmt': `type: test
title: omit inputs
import:
  users: ./nested_api.mmt
steps:
  - call: users
    id: res
    title: create-user
    inputs:
      nickname: omit
      token: omit
      email: kept@example.com
    expect:
      status: 200
      email: kept@example.com
      nickname: omit
      missing: omit
`,
        },
        'omit_inputs.mmt');

    expect(result.result.success).toBe(true);
    expect(sentRequests).toHaveLength(1);
    const sent = sentRequests[0];
    const body = JSON.parse(sent.body);
    expect(body).toEqual({
      user: {
        email: 'kept@example.com',
        profile: {keep: 'yes'},
      },
      meta: {source: 'test'},
    });
    expect(sent.headers).not.toHaveProperty('Authorization');
    expect(sent.headers['X-Email']).toBe('kept@example.com');
    expect(JSON.stringify(sent)).not.toContain(OMIT_SENTINEL);

    const reports = allReportTexts(collected);
    assertNoOmitSentinel(
        reports.md, reports.mdDetailed, reports.junit, reports.mmt, reports.html);

    // md-detailed embeds the request that was actually sent
    expect(reports.mdDetailed).toContain('## Step Details');
    expect(reports.mdDetailed).toContain('create-user');
    expect(reports.mdDetailed).toContain('kept@example.com');
    expect(reports.mdDetailed).not.toContain('"nickname"');
    expect(reports.mdDetailed).not.toContain('Bearer');

    // expects that used omit show the keyword, not the marker
    const steps = collected.testRuns.flatMap(r => r.steps);
    const comparisons = steps.flatMap(s => (s.expects || []).map(e => e.comparison)).join('\n');
    expect(comparisons).toContain('nickname == omit');
    expect(comparisons).toContain('missing == omit');
    expect(comparisons).not.toContain(OMIT_SENTINEL);

    // details JSON restored for panels / md-detailed parse
    for (const step of steps) {
      if (typeof step.details === 'string') {
        expect(step.details).not.toContain(OMIT_SENTINEL);
        expect(
            step.details.includes('"missing":"omit"') ||
            step.details.includes('"missing": "omit"'))
            .toBe(true);
      }
    }
  });

  it('quoted "omit" and null are sent as real values and appear in reports', async () => {
    const {collected} = await runWithCollector(
        {
          'echo_api.mmt': `type: api
url: https://example.com/echo
method: post
inputs:
  message: hello
  flag: null
body:
  message: i:message
  flag: i:flag
outputs:
  message: body.echoed.message
  flag: body.echoed.flag
`,
          'literal_inputs.mmt': `type: test
title: literal inputs
import:
  echo: ./echo_api.mmt
steps:
  - call: echo
    title: literals
    inputs:
      message: "omit"
      flag: null
    expect:
      message: "omit"
      flag: null
`,
        },
        'literal_inputs.mmt');

    expect(sentRequests).toHaveLength(1);
    expect(JSON.parse(sentRequests[0].body)).toEqual({message: 'omit', flag: null});

    const {mdDetailed, mmt} = allReportTexts(collected);
    assertNoOmitSentinel(mdDetailed, mmt);
    expect(mdDetailed).toContain('"message": "omit"');
    // null should still be visible in request/response body
    expect(mdDetailed).toMatch(/"flag":\s*null/);
  });

  it('failed expect against omit shows omit in junit/html failure text', async () => {
    const {collected} = await runWithCollector(
        {
          'echo_api.mmt': `type: api
url: https://example.com/echo
method: post
inputs:
  message: hello
body:
  message: i:message
outputs:
  message: body.echoed.message
  missing: body.nothing
`,
          'fail_omit.mmt': `type: test
title: fail omit
import:
  echo: ./echo_api.mmt
steps:
  - call: echo
    title: expect-present
    inputs:
      message: hello
    expect:
      missing: != omit
`,
        },
        'fail_omit.mmt');

    const steps = collected.testRuns.flatMap(r => r.steps);
    expect(steps.some(s => s.status === 'failed')).toBe(true);

    const {junit, html, md, mmt} = allReportTexts(collected);
    assertNoOmitSentinel(junit, html, md, mmt);
    expect(junit + html + md + mmt).toMatch(/omit/i);
    expect(junit).toContain('failures="1"');
  });
});

describe('multi-layer requests in reports', () => {
  beforeEach(() => {
    sentRequests.length = 0;
  });

  it('parent → child test → api strips omit through the call chain', async () => {
    const {collected, result} = await runWithCollector(
        {
          'api.mmt': `type: api
url: https://example.com/layer
method: post
inputs:
  outer: a
  mid: b
  inner: c
body:
  layer1:
    outer: i:outer
    layer2:
      mid: i:mid
      layer3:
        inner: i:inner
        keep: 1
outputs:
  outer: body.echoed.layer1.outer
  mid: body.echoed.layer1.layer2.mid
  inner: body.echoed.layer1.layer2.layer3.inner
  missingDeep: body.echoed.layer1.layer2.layer3.absent
`,
          'child.mmt': `type: test
title: child layer
import:
  api: ./api.mmt
inputs:
  outer: default-outer
  mid: default-mid
  inner: default-inner
outputs:
  outer: null
  mid: null
  inner: null
  missingDeep: null
steps:
  - call: api
    id: layered
    title: child-call
    inputs:
      outer: i:outer
      mid: i:mid
      inner: i:inner
    expect:
      missingDeep: omit
    report:
      external: all
  - set:
      outputs.outer: $\{layered.outer\}
      outputs.mid: $\{layered.mid\}
      outputs.inner: $\{layered.inner\}
      outputs.missingDeep: $\{layered.missingDeep\}
`,
          'parent.mmt': `type: test
title: parent layer
import:
  child: ./child.mmt
steps:
  - call: child
    title: parent-call
    inputs:
      outer: kept-outer
      mid: omit
      inner: omit
    expect:
      outer: kept-outer
      mid: omit
      inner: omit
      missingDeep: omit
`,
        },
        'parent.mmt');

    expect(result.result.success).toBe(true);
    expect(sentRequests).toHaveLength(1);
    expect(JSON.parse(sentRequests[0].body)).toEqual({
      layer1: {
        outer: 'kept-outer',
        layer2: {
          layer3: {keep: 1},
        },
      },
    });

    const reports = allReportTexts(collected);
    assertNoOmitSentinel(
        reports.md, reports.mdDetailed, reports.junit, reports.mmt, reports.html);

    expect(reports.mdDetailed).toContain('kept-outer');
    // Request body (not the mock response's nested.inner) must omit mid/inner.
    const requestSection = reports.mdDetailed.split('#### Response')[0] || '';
    expect(requestSection).toContain('#### Request');
    expect(requestSection).not.toMatch(/"mid"\s*:/);
    expect(requestSection).not.toMatch(/"inner"\s*:/);

    const steps = collected.testRuns.flatMap(r => r.steps);
    const comparisons = steps.flatMap(s => (s.expects || []).map(e => e.comparison));
    expect(comparisons.some(c => c.includes('missingDeep == omit'))).toBe(true);
    expect(comparisons.some(c => c.includes('mid == omit'))).toBe(true);
    expect(comparisons.join('\n')).not.toContain(OMIT_SENTINEL);

    for (const step of steps) {
      if (step.details) {
        expect(step.details).not.toContain(OMIT_SENTINEL);
      }
      for (const exp of step.expects || []) {
        if (exp.actual !== undefined) {
          expect(String(exp.actual)).not.toContain(OMIT_SENTINEL);
        }
        if (exp.expected !== undefined) {
          expect(String(exp.expected)).not.toContain(OMIT_SENTINEL);
        }
      }
    }
  });

  it('md-detailed shows nested request/response for a multi-field JSON body', async () => {
    const {collected} = await runWithCollector(
        {
          'api.mmt': `type: api
url: https://example.com/nested
method: post
inputs:
  a: "1"
  b: "2"
body:
  one:
    a: i:a
    two:
      b: i:b
outputs:
  a: body.echoed.one.a
`,
          'nested.mmt': `type: test
title: nested body
import:
  api: ./api.mmt
steps:
  - call: api
    title: nested-send
    inputs:
      a: alpha
      b: beta
    expect:
      a: alpha
      status: 200
`,
        },
        'nested.mmt');

    const {mdDetailed} = allReportTexts(collected);
    expect(mdDetailed).toContain('## Step Details');
    expect(mdDetailed).toContain('nested-send');
    expect(mdDetailed).toContain('#### Request');
    expect(mdDetailed).toContain('#### Response');
    expect(mdDetailed).toContain('"a": "alpha"');
    expect(mdDetailed).toContain('"b": "beta"');
    expect(mdDetailed).toContain('```json');
    expect(collected.testRuns.flatMap(r => r.steps).every(s => s.status === 'passed'))
        .toBe(true);
  });
});

describe('report serializers display omit from collected steps', () => {
  it('md / junit / mmt / html never leak the sentinel from expects or details', () => {
    const details = JSON.stringify({
      missing: 'omit',
      present: 'yes',
      _: {
        status: 200,
        reportOutputKeys: ['missing', 'present'],
        details: JSON.stringify({
          request: {
            method: 'post',
            url: 'https://example.com/x',
            headers: {'content-type': 'application/json'},
            body: {keep: 1},
          },
          response: {
            status: 200,
            statusText: 'OK',
            headers: {'content-type': 'application/json'},
            body: {present: 'yes'},
          },
        }),
      },
    });

    const collected = {
      type: 'test' as const,
      testRuns: [{
        runId: 'r1',
        displayName: 'omit-display.mmt',
        result: 'failed' as const,
        steps: [{
          stepIndex: 0,
          stepType: 'check' as const,
          status: 'failed' as const,
          title: 'missing-check',
          details,
          timestamp: Date.now(),
          expects: [
            {
              comparison: 'missing == present',
              actual: 'omit',
              expected: 'present',
              status: 'failed' as const,
            },
            {
              comparison: 'present == yes',
              actual: 'yes',
              expected: 'yes',
              status: 'passed' as const,
            },
          ],
        }],
      }],
    };

    const reports = allReportTexts(collected);
    assertNoOmitSentinel(
        reports.md, reports.mdDetailed, reports.junit, reports.mmt, reports.html);
    expect(reports.md).toContain('got: omit');
    expect(reports.mdDetailed).toContain('"keep": 1');
    expect(reports.junit).toContain('actual: omit');
    expect(reports.mmt).toContain('actual: omit');
  });
});
