import { generateJunitXml, escapeXml } from './junitXml';
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

describe('escapeXml', () => {
  it('escapes all XML special characters', () => {
    expect(escapeXml('a & b < c > d " e \' f')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f'
    );
  });

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });
});

describe('generateJunitXml', () => {
  it('generates valid XML for standalone test with all passes', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'my-test.mmt',
          filePath: 'tests/my-test.mmt',
          durationMs: 1234,
          steps: [
            makeStep({ stepIndex: 0, title: 'status == 200', durationMs: 100 }),
            makeStep({ stepIndex: 1, title: 'body.name == John', durationMs: 50 }),
          ],
        }),
      ],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="0"');
    expect(xml).toContain('<testsuite name="my-test.mmt"');
    expect(xml).toContain('file="tests/my-test.mmt"');
    expect(xml).toContain('<testcase name="status == 200"');
    expect(xml).toContain('<testcase name="body.name == John"');
    expect(xml).not.toContain('<failure');
    expect(xml).toContain('</testsuites>');
  });

  it('generates failure elements for failed steps', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test.mmt',
          steps: [
            makeStep({
              stepIndex: 0,
              title: 'name == John',
              status: 'failed',
              expects: [{ comparison: '==', actual: 'Jane', expected: 'John', status: 'failed' }],
              durationMs: 50,
            }),
          ],
        }),
      ],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('<failure');
    expect(xml).toContain('expected: John');
    expect(xml).toContain('actual: Jane');
    expect(xml).toContain('operator: ==');
    expect(xml).toContain('type="check"');
  });

  it('generates nested testsuites for suite run', () => {
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
          filePath: 'tests/test-a.mmt',
          durationMs: 1000,
          steps: [makeStep({ title: 'check-a' })],
        }),
        makeRun({
          displayName: 'test-b.mmt',
          filePath: 'tests/test-b.mmt',
          durationMs: 2000,
          steps: [makeStep({ title: 'check-b' })],
        }),
      ],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('name="my-suite.mmt"');
    expect(xml).toContain('tests="2"');
    expect(xml).toContain('<testsuite name="test-a.mmt"');
    expect(xml).toContain('<testsuite name="test-b.mmt"');
    expect(xml).toContain('time="3.456"');
  });

  it('handles empty test (no steps)', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun({ displayName: 'empty.mmt' })],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('tests="0"');
    expect(xml).toContain('<testsuite name="empty.mmt" tests="0"');
    expect(xml).not.toContain('<testcase');
  });

  it('escapes special characters in names', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          displayName: 'test <"special"> & \'chars\'',
          steps: [
            makeStep({
              title: 'value == "a & b"',
            }),
          ],
        }),
      ],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('test &lt;&quot;special&quot;&gt; &amp; &apos;chars&apos;');
    expect(xml).toContain('value == &quot;a &amp; b&quot;');
  });

  it('includes cancelled property when run was cancelled', () => {
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

    const xml = generateJunitXml(results);
    expect(xml).toContain('<property name="cancelled" value="true"/>');
  });

  it('uses suiteName option when provided', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [makeRun()],
    };

    const xml = generateJunitXml(results, { suiteName: 'My Custom Suite' });
    expect(xml).toContain('name="My Custom Suite"');
  });

  it('uses step index as fallback name when title is missing', () => {
    const results: CollectedResults = {
      type: 'test',
      testRuns: [
        makeRun({
          steps: [makeStep({ stepIndex: 3 })],
        }),
      ],
    };

    const xml = generateJunitXml(results);
    expect(xml).toContain('name="step-3"');
  });
});
