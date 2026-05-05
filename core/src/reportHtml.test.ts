import { generateReportHtml } from './reportHtml';
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

describe('generateReportHtml', () => {
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
    expect(html).toContain('<section class="suite">');
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
              expects: [{ comparison: '==', actual: 'Jane', expected: 'John', status: 'failed' }],
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<div class="expects">');
    expect(html).toContain('>✗</span> ==');
    expect(html).toContain('got: Jane');
  });

  it('escapes special characters in HTML', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test <script>',
          steps: [makeStep({ title: 'a & b < c' })],
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
    expect(html).toContain('Requests per second and Response time over time');
    expect(html).toContain('Threads and Failures over time');
    expect(html).toContain('<svg');
  });
});
