import YAML from 'yaml';
import { generateMmtReport } from './mmtReport';
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

describe('generateMmtReport', () => {
  it('generates valid YAML for standalone test', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'my-test.mmt',
          filePath: 'tests/my-test.mmt',
          durationMs: 1234,
          steps: [
            makeStep({ title: 'status == 200', durationMs: 100 }),
            makeStep({ title: 'body.name == John', durationMs: 50 }),
          ],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.type).toBe('report');
    expect(parsed.summary.tests).toBe(2);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(0);
    expect(parsed.suites).toHaveLength(1);
    expect(parsed.suites[0].name).toBe('my-test.mmt');
    expect(parsed.suites[0].file).toBe('tests/my-test.mmt');
    expect(parsed.suites[0].tests).toHaveLength(2);
  });

  it('generates suite with multiple test files', () => {
    const results: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        suitePath: 'my-suite.mmt',
        startedAt: 1709720000000,
        finishedAt: 1709720003456,
        durationMs: 3456,
        success: true,
        totalRunnable: 2,
        testRuns: [],
      },
      testRuns: [
        makeRun({
          displayName: 'test-a.mmt',
          steps: [makeStep({ title: 'check-a' })],
        }),
        makeRun({
          displayName: 'test-b.mmt',
          steps: [makeStep({ title: 'check-b' })],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.name).toBe('my-suite.mmt');
    expect(parsed.suites).toHaveLength(2);
    expect(parsed.suites[0].name).toBe('test-a.mmt');
    expect(parsed.suites[1].name).toBe('test-b.mmt');
    expect(parsed.timestamp).toBeDefined();
  });

  it('includes failure details for failed steps', () => {
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
              durationMs: 50,
            }),
          ],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    const test = parsed.suites[0].tests[0];
    expect(test.result).toBe('failed');
    expect(test.failure).toBeDefined();
    expect(test.failure.actual).toBe('Jane');
    expect(test.failure.expected).toBe('John');
    expect(test.failure.operator).toBe('==');
  });

  it('handles empty test (no steps)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun({ displayName: 'empty.mmt' })],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.suites[0].tests).toEqual([]);
    expect(parsed.summary.tests).toBe(0);
  });

  it('includes cancelled flag when run was cancelled', () => {
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

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.cancelled).toBe(true);
  });

  it('outputs valid YAML (round-trip parse)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          durationMs: 500,
          steps: [
            makeStep({ title: 'a', durationMs: 100 }),
            makeStep({ title: 'b', status: 'failed', actual: '1', expected: '2', durationMs: 200 }),
          ],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);
    const reparsed = YAML.parse(YAML.stringify(parsed));

    expect(reparsed).toEqual(parsed);
  });

  it('formats duration as Xs string', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          durationMs: 1234,
          steps: [makeStep({ title: 'a', durationMs: 567 })],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.duration).toBe('1s 234ms');
    expect(parsed.suites[0].duration).toBe('1s 234ms');
    expect(parsed.suites[0].tests[0].duration).toBe('567ms');
  });

  it('uses suiteName option when provided', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const output = generateMmtReport(results, { suiteName: 'My Suite' });
    const parsed = YAML.parse(output);

    expect(parsed.name).toBe('My Suite');
  });
});
