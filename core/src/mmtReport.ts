import YAML from 'yaml';
import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import { formatDuration } from './CommonData';
import {roundReportNumbersDeep} from './reportFormat';
import {applyProjectRootPaths} from './reportPaths';
import {reportStepTitle} from './reportStepTitle';
import {
  buildReportTree,
  isSuiteOnlyRun,
  reportableRuns,
  visibleReportSteps,
  type ReportTreeNode,
} from './reportTree';

export interface MmtReportOptions {
  suiteName?: string;
  /** Folder containing `multimeter.mmt` — rewrites `file` to `+/…`. */
  projectRoot?: string;
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
    name: reportStepTitle(step),
    type: 'check',
    result: step.status,
  };
  if (step.stepType !== 'check') {
    entry.step = step.stepType;
  }
  if (step.durationMs != null) {
    entry.duration = formatDuration(step.durationMs);
  }
  // Passed expects (soft or require) are omitted — step result alone is enough.
  const failedExpects = (step.expects || []).filter(e => e.status === 'failed');
  if (failedExpects.length > 0) {
    entry.expects = failedExpects.map(e => {
      const item: Record<string, any> = {
        comparison: e.comparison,
        result: e.status,
      };
      if (e.actual != null) {
        item.actual = displayValue(e.actual);
      }
      if (e.expected != null) {
        item.expected = displayValue(e.expected);
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

function buildRunEntry(run: TestRunResult, childEntries: Record<string, any>[]): Record<string, any> {
  const steps = visibleReportSteps(run);
  const entry: Record<string, any> = {
    name: run.displayName || run.filePath || `test-${run.runId}`,
    type: run.docType === 'suite' || isSuiteOnlyRun(run) ? 'suite' : 'test',
  };
  if (run.filePath) {
    entry.file = run.filePath;
  }
  if (run.durationMs != null) {
    entry.duration = formatDuration(run.durationMs);
  }
  entry.result = run.result;

  const stepEntries = entry.type !== 'suite' && steps.length > 0
    ? steps.map(buildStepEntry)
    : [];
  const nested = [...childEntries, ...stepEntries];
  if (nested.length > 0) {
    entry.checks = nested;
  }
  return entry;
}

function buildTreeEntry(node: ReportTreeNode): Record<string, any> {
  return buildRunEntry(node.run, node.children.map(buildTreeEntry));
}

function buildLoadSnapshots(results: CollectedResults): Array<Record<string, any>> | undefined {
  const load = results.load;
  if (!load) {
    return undefined;
  }
  if (Array.isArray(load.snapshots)) {
    return load.snapshots.map(point => roundReportNumbersDeep({...point}));
  }
  if (!Array.isArray(load.series)) {
    return undefined;
  }
  const startedAt = results.suiteRun?.startedAt || (load.config?.started_at ? new Date(load.config.started_at).getTime() : undefined);
  const snapshotsBySecond = new Map<number, Record<string, any>>();
  load.series.forEach((point, index) => {
    const snapshot: Record<string, any> = {...point};
    delete snapshot.timestamp;
    const pointTime = point.timestamp ? new Date(point.timestamp).getTime() : undefined;
    const elapsed = startedAt && pointTime && Number.isFinite(pointTime)
      ? Math.floor((pointTime - startedAt) / 1000)
      : index;
    snapshot.at = Math.max(0, elapsed || 0);
    snapshotsBySecond.set(snapshot.at, roundReportNumbersDeep(snapshot));
  });
  return Array.from(snapshotsBySecond.values()).sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
}

export function generateMmtReport(results: CollectedResults, options?: MmtReportOptions): string {
  results = applyProjectRootPaths(results, options?.projectRoot);
  const runs = results.testRuns;
  const counted = reportableRuns(runs);
  const totalTests = counted.reduce((sum, r) => sum + visibleReportSteps(r).length, 0);
  const totalPassed = counted.reduce((sum, r) => sum + visibleReportSteps(r).filter(s => s.status === 'passed').length, 0);
  const totalFailed = counted.reduce((sum, r) => sum + visibleReportSteps(r).filter(s => s.status === 'failed').length, 0);
  const skippedFiles = counted.filter(r => r.result === 'skipped').length;
  const isLoad = results.type === 'loadtest' || !!results.load;

  const report: Record<string, any> = {
    type: 'report',
    kind: isLoad ? 'load' : 'functional',
    name: options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath
      || reportableRuns(results.testRuns)[0]?.displayName || 'Test Report',
  };

  const overview: Record<string, any> = {};
  if (results.suiteRun?.startedAt) {
    overview.started_at = new Date(results.suiteRun.startedAt).toISOString();
  }
  if (results.suiteRun?.finishedAt) {
    overview.finished_at = new Date(results.suiteRun.finishedAt).toISOString();
  }
  overview.duration = formatDuration(
    results.suiteRun?.durationMs ?? counted.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );

  if (isLoad && results.load) {
    report.overview = {
      ...overview,
      ...roundReportNumbersDeep(results.load.summary || {}),
      errors: 0,
      skipped: 0,
    };
    if (results.load.test) { report.test = results.load.test; }
    if (results.load.config) {
      const {started_at: _startedAt, finished_at: _finishedAt, ...config} = results.load.config;
      report.config = config;
    }
    if (results.load.latency) { report.latency = roundReportNumbersDeep(results.load.latency); }
    if (results.load.http) { report.http = roundReportNumbersDeep(results.load.http); }
    if (results.load.thresholds) { report.thresholds = roundReportNumbersDeep(results.load.thresholds); }
    if (results.load.errors) { report.errors = roundReportNumbersDeep(results.load.errors); }
    const snapshots = buildLoadSnapshots(results);
    if (snapshots && snapshots.length > 0) {
      report.snapshots = snapshots;
    }
  } else {
    report.overview = {
      ...overview,
      passed: totalPassed,
      failed: totalFailed,
      errors: 0,
      skipped: skippedFiles,
      checks: totalTests,
    };
  }

  if (results.suiteRun?.cancelled) {
    report.cancelled = true;
  }

  if (!isLoad) {
    const tree = buildReportTree(runs);
    report.checks = tree.map(buildTreeEntry);
  }

  return YAML.stringify(report, { lineWidth: 0 });
}
