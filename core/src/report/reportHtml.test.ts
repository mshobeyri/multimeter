import { generateReportHtml, parentSuiteNodeId } from './reportHtml';
import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';

function makeStep(overrides: Partial<TestStepResult> = {}): TestStepResult {
  return {
    stepIndex: 0,
    stepType: 'check',
    status: 'passed',
    expects: [],
    timestamp: 1709720000000,
    ...overrides,
  };
}

function makeRun(overrides: Partial<TestRunResult> = {}): TestRunResult {
  return {
    runId: 'run-1',
    result: 'passed',
    steps: [],
    ...overrides,
  };
}

describe('parentSuiteNodeId', () => {
  it('walks suite-node paths', () => {
    expect(parentSuiteNodeId('suite-node:0.1.2')).toBe('suite-node:0.1');
    expect(parentSuiteNodeId('suite-node:0')).toBe('suite-node:root');
    expect(parentSuiteNodeId('suite-node:root')).toBeUndefined();
    expect(parentSuiteNodeId('custom')).toBeUndefined();
  });
});

describe('generateReportHtml', () => {
  it('renders skipped runs without failed styling', () => {
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        suitePath: 'suite.mmt',
        startedAt: 1709720000000,
        durationMs: 1000,
        success: true,
        totalRunnable: 1,
        testRuns: [],
      },
      testRuns: [
        makeRun({
          displayName: 'tagged-out.mmt',
          result: 'skipped',
          steps: [],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('title="skipped"');
    expect(html).toContain('badge skipped');
    expect(html).not.toContain('badge failed');
    expect(html).not.toContain('>✗<');
  });

  it('generates valid HTML with summary boxes', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({ title: 'check-a' }),
            makeStep({ title: 'check-b', status: 'failed', expects: [{ comparison: '==', actual: '1', expected: '2', status: 'failed' }] }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('summary-boxes');
    expect(html).toContain('box-passed');
    expect(html).toContain('box-failed');
    expect(html).toContain('box-total');
    expect(html).toContain('box-duration');
    expect(html).toContain('>1<');  // 1 passed
    expect(html).toContain('</html>');
  });

  it('generates suite sections for multiple test runs', () => {
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        suitePath: 'suite.mmt',
        startedAt: 1709720000000,
        durationMs: 3000,
        success: true,
        totalRunnable: 2,
        testRuns: [],
      },
      testRuns: [
        makeRun({ displayName: 'test-a.mmt', steps: [makeStep({ title: 'a' })] }),
        makeRun({ displayName: 'test-b.mmt', steps: [makeStep({ title: 'b' })] }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('test-a.mmt');
    expect(html).toContain('test-b.mmt');
    expect(html).toContain('class="report-tree"');
    expect(html).toContain('class="tree-title"');
    expect(html).toContain('1 Passed');
  });

  it('nests suite items into a tree from node ids and omits groups', () => {
    const results: CollectedResults = {
      type: 'suite',
      testRuns: [
        makeRun({ id: 'suite-node:0', displayName: 'Group 1', docType: 'group', steps: [] }),
        makeRun({
          id: 'suite-node:0.0',
          displayName: 'nested-suite.mmt',
          docType: 'suite',
          steps: [],
        }),
        makeRun({
          id: 'suite-node:0.0.0',
          displayName: 'authorise user for transaction 1U - long title that used to squash the badge',
          docType: 'test',
          steps: [makeStep({ title: 'check status' })],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).not.toContain('Group 1');
    expect(html).toContain('nested-suite.mmt');
    expect(html).toContain('authorise user for transaction 1U');
    expect(html).toContain('tree-title');
    expect(html).toContain('1 Passed');
    expect(html).not.toContain('1 step');
  });

  it('uses a suite icon for suite-only rows', () => {
    const results: CollectedResults = {
      type: 'suite',
      testRuns: [
        makeRun({ displayName: 'nested-suite.mmt', docType: 'suite', steps: [] }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('title="Suite"');
    expect(html).toContain('suite-layers-icon');
    expect(html).not.toContain('>✓</span> nested-suite.mmt');
  });

  it('uses failed badge styling for failed nested suites', () => {
    const results: CollectedResults = {
      type: 'suite',
      testRuns: [
        makeRun({
          id: 'suite-node:0',
          displayName: 'child-suite.mmt',
          docType: 'suite',
          result: 'failed',
          steps: [],
        }),
        makeRun({
          id: 'suite-node:0.0',
          displayName: 'fail.mmt',
          docType: 'test',
          result: 'failed',
          steps: [
            makeStep({
              title: 'bad',
              status: 'failed',
              expects: [{ comparison: 'x == 1', actual: '0', expected: '1', status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('badge failed">Failed</span>');
    expect(html).not.toContain('badge passed">Failed</span>');
    expect(html).not.toContain('badge passed">failed</span>');
  });

  it('includes failure details with actual/expected', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'name == John',
              status: 'failed',
              expects: [{ comparison: 'name >80% John', actual: 'Jane', expected: 'John', similarity: 25, status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('1/1 Failed');
    expect(html).toContain('name == John');
    expect(html).toContain('name &gt;80% John');
    expect(html).toContain('got: Jane');
    expect(html).toContain('expected: John');
    expect(html).toContain('similarity: 25%');
    expect(html).toContain('id="pane-0-s0"');
    expect(html).toContain('id="pane-0-s0-e0"');
    expect(html).not.toContain('step-1');
  });

  it('nests expects under call/check steps instead of flattening', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'Failing Test',
          result: 'failed',
          steps: [
            makeStep({
              title: 'echo',
              status: 'failed',
              expects: [
                { comparison: 'duration < 10', actual: 159, expected: 10, status: 'failed' },
                { comparison: 'status == 100', actual: 200, expected: 100, status: 'failed' },
              ],
            }),
            makeStep({
              title: 'Check',
              status: 'failed',
              expects: [
                { comparison: 'result.status_code == 999', actual: 200, expected: 999, status: 'failed' },
              ],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('>echo</span>');
    expect(html).toContain('>Check</span>');
    expect(html).toContain('duration &lt; 10');
    expect(html).toContain('status == 100');
    expect(html).toContain('result.status_code == 999');
    expect(html).toContain('id="pane-0-s0"');
    expect(html).toContain('id="pane-0-s1"');
    expect(html).toContain('id="pane-0-s0-e0"');
    expect(html).toContain('id="pane-0-s0-e1"');
    expect(html).toContain('id="pane-0-s1-e0"');
    expect(html).toContain('got: 159');
    expect(html).toContain('got: 200');
  });

  it('shows resolved expected under got when the authored RHS is a token', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'check-token',
              status: 'failed',
              expects: [{
                comparison: 'token == c:uuid',
                actual: 'aaa',
                expected: 'bbb',
                status: 'failed',
              }],
            }),
          ],
        }),
      ],
    };
    const html = generateReportHtml(results);
    expect(html).toContain('got: aaa');
    expect(html).toContain('expected: bbb');
  });

  it('includes passed fuzzy details with got and similarity', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'name >80% John',
              status: 'passed',
              expects: [{ comparison: 'name >80% Jon', actual: 'John', expected: 'Jon', similarity: 75, status: 'passed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('name &gt;80% Jon');
    expect(html).toContain('got: John');
    expect(html).toContain('similarity: 75%');
  });

  it('includes passed length/count details with got and count', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'users =# 3',
              status: 'passed',
              expects: [{ comparison: 'users =# 3', actual: ['a', 'b', 'c'], expected: 3, count: 3, status: 'passed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('users =# 3');
    expect(html).toContain('got: [&quot;a&quot;,&quot;b&quot;,&quot;c&quot;]');
    expect(html).toContain('count: 3');
  });

  it('keeps actual/expected on failures and omits request/response payloads', () => {
    const details = JSON.stringify({
      _: {
        details: JSON.stringify({
          request: {
            method: 'GET',
            url: 'https://example.com',
            headers: { Accept: 'application/json' },
          },
          response: {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
            body: { error: 'bad', headers: { nested: true } },
          },
        }),
      },
    });
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'failing call',
              status: 'failed',
              details,
              expects: [{ comparison: 'status == 200', actual: '400', expected: '200', status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('failing call');
    expect(html).toContain('got: 400');
    expect(html).toContain('status == 200');
    expect(html).not.toContain('<strong>Request:</strong>');
    expect(html).not.toContain('<strong>Response:</strong>');
    expect(html).not.toContain('https://example.com');
  });

  it('escapes special characters in HTML', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test <script>',
          result: 'failed',
          steps: [
            makeStep({
              title: 'a & b < c',
              status: 'failed',
              expects: [{ comparison: 'a & b < c', actual: 'x', expected: 'y', status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('test &lt;script&gt;');
    expect(html).toContain('a &amp; b &lt; c');
  });

  it('contains inline style (self-contained)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<style>');
    expect(html).toContain('data-theme');
  });

  it('contains no external resource references (except footer link)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).not.toContain('<link');
    // The only external href is the footer Multimeter marketplace link
    const lines = html.split('\n').filter(l => l.includes('href="http'));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('marketplace.visualstudio.com');
    expect(html).not.toContain('src="http');
  });

  it('uses theme option', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const darkHtml = generateReportHtml(results, { theme: 'dark' });
    expect(darkHtml).toContain('data-theme="dark"');

    const lightHtml = generateReportHtml(results, { theme: 'light' });
    expect(lightHtml).toContain('data-theme="light"');

    const autoHtml = generateReportHtml(results, { theme: 'auto' });
    expect(autoHtml).toContain('data-theme="dark"');
  });

  it('uses suiteName option', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results, { suiteName: 'My Suite' });
    expect(html).toContain('>My Suite</h1>');
    expect(html).toContain('<title>Test Report — My Suite</title>');
  });

  it('shows Powered by Multimeter footer with link', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('Powered by');
    expect(html).toContain('Multimeter');
    expect(html).toContain('report-footer');
  });

  it('renders load test charts in HTML reports', () => {
    const results: CollectedResults = {
      type: 'loadtest',
      testRuns: [],
      load: {
        summary: {iterations: 2, requests: 4, successes: 2, failures: 0, success_rate: 1, failed_rate: 0},
        config: {threads: 2, repeat: 2, rampup: '0s'},
        series: [
          {timestamp: '2026-05-05T10:00:00.000Z', active_threads: 1, requests: 1, throughput: 1, response_time: 10, errors: 0, error_rate: 0},
          {timestamp: '2026-05-05T10:00:01.000Z', active_threads: 2, requests: 4, throughput: 3, response_time: 12, errors: 0, error_rate: 0},
        ],
      },
    };

    const html = generateReportHtml(results);
    const reportIndex = html.indexOf('<div class="section-label report-section">Report</div>');
    const metricsIndex = html.indexOf('Requests Sent:');
    const chartsIndex = html.indexOf('Requests per second and Response time over time');
    expect(metricsIndex).toBeGreaterThanOrEqual(0);
    expect(reportIndex).toBeGreaterThan(metricsIndex);
    expect(chartsIndex).toBeGreaterThan(metricsIndex);
    expect(chartsIndex).toBeGreaterThan(reportIndex);
    expect(html).toContain('<div class="section-label">Overview</div>');
    expect(html).not.toContain('Load Metrics');
    expect(html).toContain('Requests per second and Response time over time');
    expect(html).toContain('Threads and Failures over time');
    expect(html).toContain('<svg');
  });

  it('shows start and end time in report overview and relative time in duration subtitle', () => {
    const startedAt = Date.now() - (60 * 60 * 1000);
    const finishedAt = startedAt + 3000;
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        suitePath: 'suite.mmt',
        startedAt,
        finishedAt,
        durationMs: 3000,
        success: true,
        totalRunnable: 1,
        testRuns: [],
      },
      testRuns: [
        makeRun({ displayName: 'test-a.mmt', steps: [makeStep({ title: 'a' })] }),
      ],
    };

    const html = generateReportHtml(results);
    const reportIndex = html.indexOf('<div class="section-label report-section">Report</div>');
    const detailIndex = html.indexOf('Started at:');
    const suiteIndex = html.indexOf('test-a.mmt');
    expect(reportIndex).toBeGreaterThan(detailIndex);
    expect(suiteIndex).toBeGreaterThan(reportIndex);
    expect(html).toContain('<div class="section-label">Overview</div>');
    expect(html).not.toContain('Overview Details');
    expect(html).toContain('Started at:');
    expect(html).toContain('Ended at:');
    expect(html).toContain('Skipped:');
    expect(html).toContain('Total checks:');
    expect(html).toContain('Tests:');
    expect(html.indexOf('Skipped:')).toBeLessThan(html.indexOf('Total checks:'));
    expect(html).toContain(new Date(startedAt).toISOString());
    expect(html).toContain(new Date(finishedAt).toISOString());
    expect(html).toContain(`data-relative-time="${new Date(startedAt).toISOString()}"`);
    expect(html).not.toContain(`data-relative-time="${startedAt}"`);
    expect(html).toContain('ago');
  });
});
