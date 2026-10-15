import type { CollectedResults, TestStepResult, TestRunResult, SuiteRunResult } from '../reportCollector';
import type { TestStepStatus } from '../runConfig';
import { createSuiteNodeId } from '../suiteNodeId';

/**
 * Parse a `type: report` YAML object (already parsed from YAML string)
 * back into `CollectedResults`. This is the inverse of `generateMmtReport`.
 */
export function parseReportMmt(doc: Record<string, any>): CollectedResults {
  if (!doc || doc.type !== 'report') {
    throw new Error('Not a valid MMT report: missing or incorrect "type" field');
  }

  const checkEntries: any[] = Array.isArray(doc.checks) ? doc.checks : (Array.isArray(doc.suites) ? doc.suites : []);
  const testRuns: TestRunResult[] = flattenCheckEntries(checkEntries);
  const load = doc.kind === 'load' ? parseLoadData(doc) : undefined;
  const overview = doc.overview && typeof doc.overview === 'object' ? doc.overview : (doc.summary || {});
  const startedAtValue = overview.started_at ?? overview.timestamp ?? doc.started_at ?? doc.timestamp;

  const hasSuiteMeta = startedAtValue != null || overview.duration != null || doc.duration != null || overview.finished_at != null || overview.ended_at != null || checkEntries.length > 1;

  if (hasSuiteMeta || checkEntries.length > 1) {
    const commitRaw = overview.commit ?? overview.git_commit ?? overview.gitCommit;
    const gitCommit = typeof commitRaw === 'string' && commitRaw.trim()
      ? commitRaw.trim().slice(0, 8)
      : undefined;
    const branchRaw = overview.branch ?? overview.git_branch ?? overview.gitBranch;
    const gitBranch = typeof branchRaw === 'string' && branchRaw.trim()
      ? branchRaw.trim()
      : undefined;
    const tagRaw = overview.tag ?? overview.git_tag ?? overview.gitTag;
    const gitTag = typeof tagRaw === 'string' && tagRaw.trim()
      ? tagRaw.trim()
      : undefined;
    const suiteRun: SuiteRunResult = {
      runId: 'report',
      suitePath: doc.name,
      startedAt: startedAtValue ? new Date(startedAtValue).getTime() : 0,
      finishedAt: overview.finished_at ? new Date(overview.finished_at).getTime() : overview.ended_at ? new Date(overview.ended_at).getTime() : undefined,
      durationMs: parseDurationMs(overview.duration ?? doc.duration),
      success: overview
        ? (overview.failed || overview.failures || 0) === 0
        : testRuns.every(r => r.result === 'passed' || r.result === 'skipped'),
      cancelled: doc.cancelled === true ? true : undefined,
      totalRunnable: testRuns.length,
      testRuns,
      gitCommit,
      gitBranch,
      gitTag,
    };
    return { type: doc.kind === 'load' ? 'loadtest' : 'suite', suiteRun, testRuns, load };
  }

  return { type: doc.kind === 'load' ? 'loadtest' : 'test', testRuns, load };
}

function parseStepStatus(result: any): TestStepStatus {
  if (result === 'failed' || result === 'cancelled' || result === 'passed') {
    return result;
  }
  return 'passed';
}

function parseRunResult(result: any, hasFailed: boolean): TestRunResult['result'] {
  if (result === 'failed' || result === 'cancelled' || result === 'passed' || result === 'skipped') {
    return result;
  }
  return hasFailed ? 'failed' : 'passed';
}

function isRunEntry(entry: any): boolean {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  if (entry.type === 'suite' || entry.type === 'test') {
    return true;
  }
  // Legacy suites[] items without type, or nested runs with nested checks of suite/test.
  if (Array.isArray(entry.tests)) {
    return true;
  }
  if (Array.isArray(entry.checks) && entry.checks.some((c: any) => c && (c.type === 'suite' || c.type === 'test'))) {
    return true;
  }
  return false;
}

function isStepEntry(entry: any): boolean {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  if (entry.type === 'suite' || entry.type === 'test') {
    return false;
  }
  return entry.type === 'check' || entry.step === 'assert' || entry.step === 'debug' || entry.step === 'check'
    || Array.isArray(entry.expects) || !!entry.failure || entry.result != null;
}

function flattenCheckEntries(entries: any[], parentPath: number[] = []): TestRunResult[] {
  const runs: TestRunResult[] = [];
  entries.forEach((entry, i) => {
    if (!isRunEntry(entry) && !isStepEntry(entry) && !entry?.name) {
      return;
    }
    // Top-level legacy flat list: each entry is a run (even if type is check for old samples).
    if (parentPath.length === 0 || isRunEntry(entry)) {
      const path = [...parentPath, i];
      const nested = Array.isArray(entry.checks) ? entry.checks : (Array.isArray(entry.tests) ? entry.tests : []);
      const childRuns = nested.filter(isRunEntry);
      const stepEntries = nested.filter((c: any) => !isRunEntry(c) && isStepEntry(c));
      const steps = stepEntries.map((t: any, si: number) => parseTestEntry(t, si));
      const hasFailed = steps.some((s: TestStepResult) => s.status === 'failed');
      const docType = entry.type === 'suite' ? 'suite' : entry.type === 'test' ? 'test' : (childRuns.length > 0 ? 'suite' : 'test');
      runs.push({
        runId: `run-${path.join('-')}`,
        id: createSuiteNodeId(path),
        filePath: entry.file,
        displayName: entry.name || `test-${path.join('.')}`,
        docType,
        result: parseRunResult(entry.result, hasFailed),
        durationMs: parseDurationMs(entry.duration),
        steps,
      });
      if (childRuns.length > 0) {
        runs.push(...flattenCheckEntries(childRuns, path));
      }
      return;
    }
  });
  return runs;
}

function parseTestEntry(test: any, index: number): TestStepResult {
  const step: TestStepResult = {
    stepIndex: index,
    stepType: test.step === 'assert' || test.type === 'assert' ? 'assert' : test.step === 'debug' ? 'debug' : 'check',
    status: parseStepStatus(test.result),
    expects: [],
    timestamp: 0,
    durationMs: parseDurationMs(test.duration),
    title: test.name,
  };

  if (Array.isArray(test.expects)) {
    step.expects = test.expects.map((e: any) => ({
      comparison: typeof e.comparison === 'string' ? e.comparison : '',
      actual: e.actual,
      expected: e.expected,
      status: parseStepStatus(e.result),
    }));
  } else if (test.failure) {
    // Legacy format without expects array — build a single-item expects
    step.expects = [{
      comparison: test.failure.operator || '',
      actual: test.failure.actual,
      expected: test.failure.expected,
      status: 'failed' as const,
    }];
  }

  return step;
}

function parseLoadData(doc: Record<string, any>): CollectedResults['load'] {
  if (doc.load && typeof doc.load === 'object') {
    return doc.load;
  }
  const overview = doc.overview && typeof doc.overview === 'object' ? doc.overview : doc.summary;
  const load: NonNullable<CollectedResults['load']> = {};
  if (doc.tool) { load.tool = doc.tool; }
  if (doc.scenario) { load.scenario = doc.scenario; }
  if (doc.test) { load.test = doc.test; }
  if (doc.config) { load.config = doc.config; }
  if (overview) { load.summary = overview; }
  if (doc.latency) { load.latency = doc.latency; }
  if (doc.http) { load.http = doc.http; }
  if (doc.thresholds) { load.thresholds = doc.thresholds; }
  if (doc.errors) { load.errors = doc.errors; }
  if (Array.isArray(doc.snapshots)) {
    load.snapshots = doc.snapshots;
    const startValue = overview?.started_at || overview?.timestamp || doc.started_at || doc.timestamp;
    const start = startValue ? new Date(startValue).getTime() : undefined;
    load.series = doc.snapshots.map((snapshot: any) => {
      const at = Number(snapshot.at || 0);
      const timestamp = start && Number.isFinite(at) ? new Date(start + at * 1000).toISOString() : String(snapshot.at || '');
      return {timestamp, ...snapshot};
    });
  }
  return load;
}

function parseDurationMs(duration: any): number | undefined {
  if (duration == null) {
    return undefined;
  }
  const str = String(duration);
  if (str.endsWith('s')) {
    const seconds = parseFloat(str.slice(0, -1));
    if (!isNaN(seconds)) {
      return Math.round(seconds * 1000);
    }
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return Math.round(num * 1000);
  }
  return undefined;
}
