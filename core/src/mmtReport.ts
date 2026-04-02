import YAML from 'yaml';
import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import { formatDuration } from './CommonData';

export interface MmtReportOptions {
  suiteName?: string;
}

function displayValue(v: any): string {
  if (v === null || v === undefined) {
    return String(v);
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function buildStepEntry(step: TestStepResult): Record<string, any> {
  const entry: Record<string, any> = {
    name: step.title || `step-${step.stepIndex}`,
    type: step.stepType,
    result: step.status,
  };
  if (step.durationMs != null) {
    entry.duration = formatDuration(step.durationMs);
  }
  if (step.expects && step.expects.length > 0) {
    entry.expects = step.expects.map(e => {
      const item: Record<string, any> = {
        comparison: e.comparison,
        result: e.status,
      };
      if (e.status === 'failed') {
        if (e.actual != null) {
          item.actual = displayValue(e.actual);
        }
        if (e.expected != null) {
          item.expected = displayValue(e.expected);
        }
      }
      return item;
    });
  }
  if (step.status === 'failed') {
    const failure: Record<string, any> = {};
    const parts: string[] = [];
    const failed = (step.expects || []).filter(e => e.status === 'failed');
    for (const e of failed) {
      if (e.expected != null) {
        parts.push(`${e.comparison}: expected ${displayValue(e.expected)} got ${displayValue(e.actual)}`);
      } else {
        parts.push(`${e.comparison}: failed`);
      }
    }
    failure.message = parts.join(', ') || 'assertion failed';
    if (failed.length > 0) {
      const first = failed[0];
      if (first.actual != null) {
        failure.actual = displayValue(first.actual);
      }
      if (first.expected != null) {
        failure.expected = displayValue(first.expected);
      }
      if (first.comparison) {
        failure.operator = first.comparison;
      }
    }
    entry.failure = failure;
  }
  return entry;
}

function buildSuiteEntry(run: TestRunResult): Record<string, any> {
  const entry: Record<string, any> = {
    name: run.displayName || run.filePath || `test-${run.runId}`,
  };
  if (run.filePath) {
    entry.file = run.filePath;
  }
  if (run.durationMs != null) {
    entry.duration = formatDuration(run.durationMs);
  }
  entry.result = run.result;
  entry.tests = run.steps.map(buildStepEntry);
  return entry;
}

export function generateMmtReport(results: CollectedResults, options?: MmtReportOptions): string {
  const runs = results.testRuns;
  const totalTests = runs.reduce((sum, r) => sum + r.steps.length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'failed').length, 0);

  const report: Record<string, any> = {
    type: 'report',
    name: options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report',
  };

  if (results.suiteRun?.startedAt) {
    report.timestamp = new Date(results.suiteRun.startedAt).toISOString();
  }

  report.duration = formatDuration(
    results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );

  report.summary = {
    tests: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    errors: 0,
    skipped: 0,
  };

  if (results.suiteRun?.cancelled) {
    report.cancelled = true;
  }

  report.suites = runs.map(buildSuiteEntry);

  return YAML.stringify(report, { lineWidth: 0 });
}
