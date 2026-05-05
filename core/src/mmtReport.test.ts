import YAML from 'yaml';
import { generateMmtReport } from './mmtReport';
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
    expect(parsed.overview.checks).toBe(2);
    expect(parsed.overview.passed).toBe(2);
    expect(parsed.overview.failed).toBe(0);
    expect(parsed.checks).toHaveLength(1);
    expect(parsed.checks[0].type).toBe('test');
    expect(parsed.checks[0].name).toBe('my-test.mmt');
    expect(parsed.checks[0].file).toBe('tests/my-test.mmt');
    expect(parsed.checks[0].checks).toHaveLength(2);
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
    expect(parsed.checks).toHaveLength(2);
    expect(parsed.checks[0].name).toBe('test-a.mmt');
    expect(parsed.checks[1].name).toBe('test-b.mmt');
    expect(parsed.overview.timestamp).toBeDefined();
    expect(parsed.timestamp).toBeUndefined();
  });

  it('generates non-expanded suite check entries for nested suites', () => {
    const results: CollectedResults = {
      type: 'suite',
      testRuns: [makeRun({ displayName: 'child-suite.mmt', docType: 'suite', result: 'passed' })],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.checks[0]).toEqual({name: 'child-suite.mmt', type: 'suite', result: 'passed'});
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
              expects: [{ comparison: '==', actual: 'Jane', expected: 'John', status: 'failed' }],
              durationMs: 50,
            }),
          ],
        }),
      ],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    const test = parsed.checks[0].checks[0];
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

    expect(parsed.checks[0].checks).toBeUndefined();
    expect(parsed.overview.checks).toBe(0);
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
            makeStep({ title: 'b', status: 'failed', expects: [{ comparison: '==', actual: '1', expected: '2', status: 'failed' }], durationMs: 200 }),
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

    expect(parsed.overview.duration).toBe('1s 234ms');
    expect(parsed.duration).toBeUndefined();
    expect(parsed.checks[0].duration).toBe('1s 234ms');
    expect(parsed.checks[0].checks[0].duration).toBe('567ms');
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

  it('includes load report metadata', () => {
    const results: CollectedResults = {
      type: 'loadtest',
      suiteRun: {
        runId: 'load-1',
        suitePath: './load.mmt',
        startedAt: new Date('2026-05-05T10:00:00.000Z').getTime(),
        success: true,
        totalRunnable: 1,
        testRuns: [],
      },
      load: {
        tool: 'multimeter',
        scenario: 'Login load',
        test: './tests/login.mmt',
        config: { threads: 100, repeat: '1m', rampup: '10s' },
        summary: { requests: 1000, failures: 2, error_rate: 0.002, throughput: 50 },
        latency: { avg: 42, p95: 120, p99: 240 },
        series: [
          {timestamp: '2026-05-05T10:00:00.500Z', active_threads: 10, requests: 100, throughput: 50},
          {timestamp: '2026-05-05T10:00:10.000Z', active_threads: 20, requests: 1000, throughput: 50},
          {timestamp: '2026-05-05T10:00:10.500Z', active_threads: 0, requests: 1000, throughput: 0},
        ],
      },
      testRuns: [makeRun({ displayName: 'login.mmt', steps: [makeStep({ title: 'status == 200' })] })],
    };

    const output = generateMmtReport(results);
    const parsed = YAML.parse(output);

    expect(parsed.kind).toBe('load');
    expect(parsed.config.threads).toBe(100);
    expect(parsed.overview.throughput).toBe(50);
    expect(parsed.latency.p95).toBe(120);
    expect(parsed.tool).toBeUndefined();
    expect(parsed.scenario).toBeUndefined();
    expect(parsed.checks).toBeUndefined();
    expect(parsed.load).toBeUndefined();
    expect(parsed.snapshots[0].at).toBe(0);
    expect(parsed.snapshots[0].timestamp).toBeUndefined();
    expect(parsed.snapshots.map((point: any) => point.at)).toEqual([0, 10]);
  });
});
