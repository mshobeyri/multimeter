import YAML from 'yaml';
import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import { formatDuration } from './CommonData';

export interface MmtReportOptions {
  suiteName?: string;
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
  if (step.status === 'failed') {
    const failure: Record<string, any> = {};
    const parts: string[] = [];
    if (step.expected != null) {
      parts.push(`expected ${step.expected} got ${step.actual}`);
    }
    failure.message = parts.join(', ') || 'assertion failed';
    if (step.actual != null) {
      failure.actual = String(step.actual);
    }
    if (step.expected != null) {
      failure.expected = String(step.expected);
    }
    if (step.comparison) {
      failure.operator = step.comparison;
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
