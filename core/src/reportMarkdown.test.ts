import { generateReportMarkdown } from './reportMarkdown';
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

describe('generateReportMarkdown', () => {
  it('generates Markdown with summary header and table', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          durationMs: 500,
          steps: [
            makeStep({ title: 'status == 200', durationMs: 100 }),
            makeStep({ title: 'body.ok', durationMs: 50 }),
          ],
        }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('# Test Report: test.mmt');
    expect(md).toContain('2 passed, 0 failed, 2 total checks');
    expect(md).toContain('## Tests');
    expect(md).toContain('**✓ test.mmt** passed');
    expect(md).toContain('| # | Check | Result|');
    expect(md).toContain('status == 200');
    expect(md).toContain('✓ passed');
  });

  it('generates one table per suite for multiple test runs', () => {
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

    const md = generateReportMarkdown(results);
    expect(md).toContain('**✓ test-a.mmt** passed');
    expect(md).toContain('**✓ test-b.mmt** passed');
    expect(md).toContain('# Test Report: suite.mmt');
  });

  it('adds a suite icon before the status icon for suite-only rows', () => {
    const results: CollectedResults = {
      type: 'suite',
      testRuns: [
        makeRun({ displayName: 'nested-suite.mmt', docType: 'suite', steps: [] }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('**✓ nested-suite.mmt** passed');
  });

  it('generates details blocks for failed steps', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'name == John',
              status: 'failed',
              expects: [{ comparison: 'name =80% John', actual: 'Jane', expected: 'John', similarity: 25, status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('<details>');
    expect(md).toContain('<summary>✗ name == John</summary>');
    expect(md).toContain('✗ name =80% John');
    expect(md).toContain('got: Jane');
    expect(md).toContain('similarity: 25%');
    expect(md).toContain('</details>');
    expect(md).toContain('✗ failed');
  });

  it('includes passed fuzzy details with got and similarity', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              title: 'name =80% John',
              status: 'passed',
              expects: [{ comparison: 'name =80% Jon', actual: 'John', expected: 'Jon', similarity: 75, status: 'passed' }],
            }),
          ],
        }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('<summary>✓ name =80% John</summary>');
    expect(md).toContain('✓ name =80% Jon');
    expect(md).toContain('got: John');
    expect(md).toContain('similarity: 75%');
  });

  it('renders response headers and object bodies as JSON in failure details', () => {
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
              expects: [{ comparison: '==', actual: '400', expected: '200', status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('Headers:');
    expect(md).toContain('"content-type": "application/json"');
    expect(md).toContain('"nested": true');
    expect(md).not.toContain('[object Object]');
  });

  it('handles empty test (no steps)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun({ displayName: 'empty.mmt' })],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('**✓ empty.mmt** passed');
    expect(md).toContain('0 passed, 0 failed, 0 total checks');
  });

  it('escapes pipe characters in table cells', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [makeStep({ title: 'a | b | c' })],
        }),
      ],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('a \\| b \\| c');
  });

  it('omits details when includeDetails is false', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({ title: 'fail', status: 'failed', expects: [{ comparison: '==', actual: '1', expected: '2', status: 'failed' }] }),
          ],
        }),
      ],
    };

    const md = generateReportMarkdown(results, { includeDetails: false });
    expect(md).not.toContain('<details>');
    expect(md).toContain('✗ failed');
  });

  it('includes cancelled warning', () => {
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        startedAt: 1709720000000,
        success: false,
        cancelled: true,
        totalRunnable: 5,
        testRuns: [],
      },
      testRuns: [],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('Run was cancelled');
  });

  it('uses suiteName option', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const md = generateReportMarkdown(results, { suiteName: 'My Suite' });
    expect(md).toContain('# Test Report: My Suite');
  });

  it('ends with Generated by Multimeter', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const md = generateReportMarkdown(results);
    expect(md).toContain('*Generated by **Multimeter***');
  });

  it('renders load test Mermaid xy charts in Markdown reports', () => {
    const startedAt = new Date('2026-05-05T10:00:00.000Z').getTime();
    const finishedAt = new Date('2026-05-05T10:00:02.000Z').getTime();
    const results: CollectedResults = {
      type: 'loadtest',
      suiteRun: {
        runId: 'load-1',
        startedAt,
        finishedAt,
        durationMs: 2000,
        success: true,
        totalRunnable: 1,
        testRuns: [],
      },
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

    const md = generateReportMarkdown(results);
    expect(md).toContain('```mermaid');
    expect(md).toContain('xychart');
    expect(md).toContain('x-axis [0, 1]');
    expect(md).toContain('Requests/sec over time');
    expect(md).toContain('Response time over time');
    expect(md).toContain('Failures over time');
    expect(md).toContain('Threads over time');
    expect(md).toContain('| Started at | 2026-05-05T10:00:00.000Z |');
    expect(md).toContain('| Ended at | 2026-05-05T10:00:02.000Z |');
    expect(md).toContain('| 0 | 1 | 1 | 1 | 10 | 0 | 0% |');
    expect(md).not.toContain('## undefined');
  });

  it('shows absolute start and end time in overview', () => {
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

    const md = generateReportMarkdown(results);
    expect(md).toContain(`**Started at:** ${new Date(startedAt).toISOString()}`);
    expect(md).toContain(`**Ended at:** ${new Date(finishedAt).toISOString()}`);
    expect(md).not.toContain('**Started:**');
  });
});
