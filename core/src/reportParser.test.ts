import YAML from 'yaml';
import { parseReportMmt } from './reportParser';
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

describe('parseReportMmt', () => {
  it('parses valid report YAML into CollectedResults', () => {
    const doc = {
      type: 'report',
      name: 'my-suite',
      timestamp: '2026-03-06T10:30:00.000Z',
      duration: '3.456s',
      summary: { tests: 2, passed: 1, failed: 1, errors: 0, skipped: 0 },
      suites: [
        {
          name: 'test-a.mmt',
          file: 'tests/test-a.mmt',
          duration: '1.234s',
          result: 'failed',
          tests: [
            { name: 'status == 200', type: 'check', result: 'passed', duration: '0.100s' },
            {
              name: 'name == John',
              type: 'check',
              result: 'failed',
              duration: '0.050s',
              failure: { message: 'expected John got Jane', actual: 'Jane', expected: 'John', operator: '==' },
            },
          ],
        },
      ],
    };

    const results = parseReportMmt(doc);
    expect(results.type).toBe('suite');
    expect(results.suiteRun).toBeDefined();
    expect(results.suiteRun!.suitePath).toBe('my-suite');
    expect(results.suiteRun!.durationMs).toBe(3456);
    expect(results.testRuns).toHaveLength(1);

    const run = results.testRuns[0];
    expect(run.filePath).toBe('tests/test-a.mmt');
    expect(run.displayName).toBe('test-a.mmt');
    expect(run.result).toBe('failed');
    expect(run.steps).toHaveLength(2);
    expect(run.steps[0].status).toBe('passed');
    expect(run.steps[1].status).toBe('failed');
    expect(run.steps[1].actual).toBe('Jane');
    expect(run.steps[1].expected).toBe('John');
  });

  it('parses report with failures correctly', () => {
    const doc = {
      type: 'report',
      name: 'test',
      suites: [
        {
          name: 'test.mmt',
          result: 'failed',
          tests: [
            {
              name: 'check-1',
              type: 'assert',
              result: 'failed',
              failure: { actual: '1', expected: '2', operator: '==' },
            },
          ],
        },
      ],
    };

    const results = parseReportMmt(doc);
    const step = results.testRuns[0].steps[0];
    expect(step.stepType).toBe('assert');
    expect(step.status).toBe('failed');
    expect(step.actual).toBe('1');
    expect(step.expected).toBe('2');
    expect(step.comparison).toBe('==');
  });

  it('handles empty report (no suites)', () => {
    const doc = {
      type: 'report',
      name: 'empty',
      suites: [],
    };

    const results = parseReportMmt(doc);
    expect(results.testRuns).toHaveLength(0);
  });

  it('throws for missing type field', () => {
    expect(() => parseReportMmt({ name: 'no-type' } as any)).toThrow('Not a valid MMT report');
  });

  it('throws for wrong type field', () => {
    expect(() => parseReportMmt({ type: 'test', name: 'wrong' })).toThrow('Not a valid MMT report');
  });

  it('round-trips through generateMmtReport and parseReportMmt', () => {
    const original: CollectedResults = {
      type: 'suite',
      suiteRun: {
        runId: 'suite-1',
        suitePath: 'suite.mmt',
        startedAt: 1709720000000,
        finishedAt: 1709720003456,
        durationMs: 3456,
        success: false,
        totalRunnable: 1,
        testRuns: [],
      },
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          filePath: 'tests/test.mmt',
          durationMs: 1234,
          steps: [
            makeStep({ stepIndex: 0, title: 'pass-check', status: 'passed', durationMs: 100 }),
            makeStep({
              stepIndex: 1,
              title: 'fail-check',
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

    const yamlStr = generateMmtReport(original);
    const parsed = YAML.parse(yamlStr);
    const results = parseReportMmt(parsed);

    expect(results.type).toBe('suite');
    expect(results.testRuns).toHaveLength(1);
    expect(results.testRuns[0].steps).toHaveLength(2);
    expect(results.testRuns[0].steps[0].status).toBe('passed');
    expect(results.testRuns[0].steps[1].status).toBe('failed');
    expect(results.testRuns[0].steps[1].actual).toBe('Jane');
    expect(results.testRuns[0].steps[1].expected).toBe('John');
    expect(results.testRuns[0].filePath).toBe('tests/test.mmt');
  });

  it('handles standalone test (single suite, no meta)', () => {
    const doc = {
      type: 'report',
      name: 'test',
      suites: [
        {
          name: 'test.mmt',
          result: 'passed',
          tests: [{ name: 'check', type: 'check', result: 'passed' }],
        },
      ],
    };

    const results = parseReportMmt(doc);
    expect(results.type).toBe('test');
    expect(results.suiteRun).toBeUndefined();
    expect(results.testRuns).toHaveLength(1);
  });
});
