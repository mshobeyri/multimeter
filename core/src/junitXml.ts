import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import {formatReportNumber, roundReportNumbersDeep} from './reportFormat';
import {normalizeReportGitBranch, normalizeReportGitCommit, normalizeReportGitTag} from './reportGitCommit';
import {applyProjectRootPaths} from './reportPaths';
import {reportStepTitle} from './reportStepTitle';
import {
  buildReportTree,
  reportableRuns,
  visibleReportSteps,
  type ReportTreeNode,
} from './reportTree';

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface JunitXmlOptions {
  suiteName?: string;
  /** Folder containing `multimeter.mmt` — rewrites `file` to `+/…`. */
  projectRoot?: string;
  /** Optional git HEAD SHA; emitted as a testsuites property when available. */
  gitCommit?: string;
  /** Optional git branch name; emitted as a testsuites property when available. */
  gitBranch?: string;
  /** Optional git tag(s) on HEAD; emitted as a testsuites property when available. */
  gitTag?: string;
}

function formatTime(ms?: number): string {
  if (ms == null || ms < 0) {
    return '0.000';
  }
  return (ms / 1000).toFixed(3);
}

function isoTimestamp(ts?: number): string {
  if (ts == null) {
    return new Date().toISOString();
  }
  return new Date(ts).toISOString();
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

function buildTestcase(step: TestStepResult, classname: string): string {
  const name = escapeXml(reportStepTitle(step));
  const time = formatTime(step.durationMs);
  if (step.status === 'passed') {
    return `      <testcase name="${name}" classname="${classname}" time="${time}"/>\n`;
  }
  const parts: string[] = [];
  const failed = (step.expects || []).filter(e => e.status === 'failed');
  for (const e of failed) {
    if (e.expected != null) {
      parts.push(`expected: ${displayValue(e.expected)}`);
    }
    if (e.actual != null) {
      parts.push(`actual: ${displayValue(e.actual)}`);
    }
    if (e.comparison) {
      parts.push(`operator: ${e.comparison}`);
    }
  }
  const failureMessage = escapeXml(parts.join(', ') || 'assertion failed');
  const failureBody = parts.map(p => escapeXml(p)).join('\n');
  return (
    `      <testcase name="${name}" classname="${classname}" time="${time}">\n` +
    `        <failure message="${failureMessage}" type="${escapeXml(step.stepType)}">${failureBody}</failure>\n` +
    `      </testcase>\n`
  );
}

function countNodeTests(node: ReportTreeNode): {tests: number; failures: number; skipped: number} {
  const steps = visibleReportSteps(node.run);
  let tests = node.run.result === 'skipped' ? 1 : steps.length;
  let failures = steps.filter(s => s.status === 'failed').length;
  let skipped = node.run.result === 'skipped' ? 1 : 0;
  for (const child of node.children) {
    const childCounts = countNodeTests(child);
    tests += childCounts.tests;
    failures += childCounts.failures;
    skipped += childCounts.skipped;
  }
  return {tests, failures, skipped};
}

function buildTestsuiteFromNode(node: ReportTreeNode, depth: number): string {
  const run = node.run;
  const name = escapeXml(run.displayName || run.filePath || `test-${node.index}`);
  const classname = escapeXml(run.displayName || run.filePath || `test-${node.index}`);
  const steps = visibleReportSteps(run);
  const counts = countNodeTests(node);
  const time = formatTime(run.durationMs);
  const file = run.filePath ? ` file="${escapeXml(run.filePath)}"` : '';
  const timestamp = steps.length > 0 ? ` timestamp="${isoTimestamp(steps[0].timestamp)}"` : '';
  const indent = '    ' + '  '.repeat(depth);

  let xml = `${indent}<testsuite name="${name}" tests="${counts.tests}" failures="${counts.failures}" errors="0" skipped="${counts.skipped}" time="${time}"${file}${timestamp}>\n`;
  if (run.result === 'skipped' && node.children.length === 0 && steps.length === 0) {
    xml += `${indent}  <testcase name="${name}" classname="${classname}" time="0.000"><skipped/></testcase>\n`;
  }
  for (const child of node.children) {
    xml += buildTestsuiteFromNode(child, depth + 1);
  }
  for (const step of steps) {
    xml += `${indent}` + buildTestcase(step, classname).trimStart();
  }
  xml += `${indent}</testsuite>\n`;
  return xml;
}

function getLoadSnapshots(results: CollectedResults): Array<Record<string, any>> {
  const load = results.load;
  if (!load) {
    return [];
  }
  if (Array.isArray(load.snapshots)) {
    return load.snapshots.map(point => roundReportNumbersDeep({...point}));
  }
  if (!Array.isArray(load.series)) {
    return [];
  }
  const startedAt = results.suiteRun?.startedAt || (load.config?.started_at ? new Date(load.config.started_at).getTime() : undefined);
  return load.series.map((point, index) => {
    const pointTime = point.timestamp ? new Date(point.timestamp).getTime() : undefined;
    const at = startedAt && pointTime && Number.isFinite(pointTime)
      ? Math.max(0, Math.floor((pointTime - startedAt) / 1000))
      : index;
    const snapshot: Record<string, any> = {...point, at};
    delete snapshot.timestamp;
    return roundReportNumbersDeep(snapshot);
  });
}

export function generateJunitXml(results: CollectedResults, options?: JunitXmlOptions): string {
  results = applyProjectRootPaths(results, options?.projectRoot);
  const gitCommit = normalizeReportGitCommit(options?.gitCommit ?? results.suiteRun?.gitCommit);
  const gitBranch = normalizeReportGitBranch(options?.gitBranch ?? results.suiteRun?.gitBranch);
  const gitTag = normalizeReportGitTag(options?.gitTag ?? results.suiteRun?.gitTag);
  const runs = results.testRuns;
  const counted = reportableRuns(runs);
  const suiteName = escapeXml(
    options?.suiteName
      || results.suiteRun?.suiteTitle
      || results.suiteRun?.suitePath
      || reportableRuns(results.testRuns)[0]?.displayName
      || 'Test Report',
  );
  const tree = buildReportTree(runs);
  const totals = tree.reduce(
    (acc, node) => {
      const c = countNodeTests(node);
      return {
        tests: acc.tests + c.tests,
        failures: acc.failures + c.failures,
        skipped: acc.skipped + c.skipped,
      };
    },
    {tests: 0, failures: 0, skipped: 0},
  );
  // Fallback flat count when there is no id-based tree (standalone test).
  const totalTests = totals.tests || counted.reduce((sum, r) => sum + (r.result === 'skipped' ? 1 : visibleReportSteps(r).length), 0);
  const totalFailures = totals.failures || counted.reduce((sum, r) => sum + visibleReportSteps(r).filter(s => s.status === 'failed').length, 0);
  const totalSkipped = totals.skipped || counted.filter(r => r.result === 'skipped').length;
  const totalTime = formatTime(results.suiteRun?.durationMs ?? counted.reduce((sum, r) => sum + (r.durationMs || 0), 0));
  const timestamp = results.suiteRun?.startedAt
    ? ` timestamp="${isoTimestamp(results.suiteRun.startedAt)}"`
    : '';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites name="${suiteName}" tests="${totalTests}" failures="${totalFailures}" errors="0" skipped="${totalSkipped}" time="${totalTime}"${timestamp}>\n`;

  if (results.suiteRun?.cancelled || results.load || gitCommit || gitBranch || gitTag) {
    xml += `    <properties>\n`;
    if (results.suiteRun?.cancelled) {
      xml += `        <property name="cancelled" value="true"/>\n`;
    }
    if (gitBranch) {
      xml += `        <property name="branch" value="${escapeXml(gitBranch)}"/>\n`;
    }
    if (gitCommit) {
      xml += `        <property name="commit" value="${escapeXml(gitCommit)}"/>\n`;
    }
    if (gitTag) {
      xml += `        <property name="tag" value="${escapeXml(gitTag)}"/>\n`;
    }
    if (results.load) {
      const loadProps: Array<[string, any]> = [
        ['load.threads', results.load.config?.threads],
        ['load.repeat', results.load.config?.repeat],
        ['load.rampup', results.load.config?.rampup],
        ['load.requests', results.load.summary?.requests],
        ['load.successes', results.load.summary?.successes],
        ['load.failures', results.load.summary?.failures],
        ['load.success_rate', results.load.summary?.success_rate],
        ['load.failed_rate', results.load.summary?.failed_rate],
        ['load.throughput', results.load.summary?.throughput],
        ['load.error_rate', results.load.summary?.error_rate],
        ['load.latency.p95', results.load.latency?.p95],
        ['load.latency.p99', results.load.latency?.p99],
      ];
      getLoadSnapshots(results).forEach((point, index) => {
        loadProps.push([`load.snapshots.${index}.at`, point.at]);
        loadProps.push([`load.snapshots.${index}.active_threads`, point.active_threads]);
        loadProps.push([`load.snapshots.${index}.requests`, point.requests]);
        loadProps.push([`load.snapshots.${index}.throughput`, point.throughput]);
        loadProps.push([`load.snapshots.${index}.response_time`, point.response_time]);
        loadProps.push([`load.snapshots.${index}.errors`, point.errors]);
        loadProps.push([`load.snapshots.${index}.error_delta`, point.error_delta]);
        loadProps.push([`load.snapshots.${index}.error_rate`, point.error_rate]);
      });
      for (const [name, value] of loadProps) {
        if (value !== undefined && value !== null && value !== '') {
          const formattedValue = typeof value === 'number' ? formatReportNumber(value) : String(value);
          xml += `        <property name="${escapeXml(name)}" value="${escapeXml(formattedValue)}"/>\n`;
        }
      }
    }
    xml += `    </properties>\n`;
  }

  for (const node of tree) {
    xml += buildTestsuiteFromNode(node, 0);
  }

  xml += `</testsuites>\n`;
  return xml;
}
