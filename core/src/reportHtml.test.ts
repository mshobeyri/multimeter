import { generateReportHtml } from './reportHtml';
import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';

function makeStep(overrides: Partial<TestStepResult> = {}): TestStepResult {
  return {
    stepIndex: 0,
    stepType: 'check',
    status: 'passed',
    comparison: '==',
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
  it('generates valid HTML with summary counts', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({ title: 'check-a' }),
            makeStep({ title: 'check-b', status: 'failed', actual: '1', expected: '2' }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('1 passed');
    expect(html).toContain('1 failed');
    expect(html).toContain('2 tests');
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
              actual: 'Jane',
              expected: 'John',
              comparison: '==',
            }),
          ],
        }),
      ],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<div class="failure">');
    expect(html).toContain('Expected:</strong> John');
    expect(html).toContain('Actual:</strong> Jane');
    expect(html).toContain('Operator:</strong> ==');
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
    expect(html).not.toContain('<script>');
  });

  it('contains inline style (self-contained)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('<style>');
    expect(html).toContain('prefers-color-scheme');
  });

  it('contains no external resource references', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).not.toContain('<link');
    expect(html).not.toContain('href="http');
    expect(html).not.toContain('src="http');
  });

  it('uses theme option', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const darkHtml = generateReportHtml(results, { theme: 'dark' });
    expect(darkHtml).toContain('class="theme-dark"');

    const lightHtml = generateReportHtml(results, { theme: 'light' });
    expect(lightHtml).toContain('class="theme-light"');

    const autoHtml = generateReportHtml(results, { theme: 'auto' });
    expect(autoHtml).not.toContain('class="theme-');
  });

  it('uses suiteName option', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results, { suiteName: 'My Suite' });
    expect(html).toContain('<h1>My Suite</h1>');
    expect(html).toContain('<title>Test Report — My Suite</title>');
  });

  it('shows Powered by Multimeter footer', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const html = generateReportHtml(results);
    expect(html).toContain('Powered by Multimeter');
  });
});
