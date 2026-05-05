import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';

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
  const name = escapeXml(step.title || `step-${step.stepIndex}`);
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

function buildTestsuite(run: TestRunResult, index: number): string {
  const name = escapeXml(run.displayName || run.filePath || `test-${index}`);
  const classname = escapeXml(run.displayName || run.filePath || `test-${index}`);
  const nonDebugSteps = run.steps.filter(s => s.stepType !== 'debug');
  const tests = nonDebugSteps.length;
  const failures = nonDebugSteps.filter(s => s.status === 'failed').length;
  const time = formatTime(run.durationMs);
  const file = run.filePath ? ` file="${escapeXml(run.filePath)}"` : '';
  const timestamp = nonDebugSteps.length > 0 ? ` timestamp="${isoTimestamp(nonDebugSteps[0].timestamp)}"` : '';

  let xml = `    <testsuite name="${name}" tests="${tests}" failures="${failures}" errors="0" skipped="0" time="${time}"${file}${timestamp}>\n`;
  for (const step of nonDebugSteps) {
    xml += buildTestcase(step, classname);
  }
  xml += `    </testsuite>\n`;
  return xml;
}

function getLoadSnapshots(results: CollectedResults): Array<Record<string, any>> {
  const load = results.load;
  if (!load) {
    return [];
  }
  if (Array.isArray(load.snapshots)) {
    return load.snapshots.map(point => ({...point}));
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
    return snapshot;
  });
}

export function generateJunitXml(results: CollectedResults, options?: JunitXmlOptions): string {
  const runs = results.testRuns;
  const suiteName = escapeXml(options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report');
  const totalTests = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug').length, 0);
  const totalFailures = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'failed').length, 0);
  const totalTime = formatTime(results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0));
  const timestamp = results.suiteRun?.startedAt
    ? ` timestamp="${isoTimestamp(results.suiteRun.startedAt)}"`
    : '';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites name="${suiteName}" tests="${totalTests}" failures="${totalFailures}" errors="0" skipped="0" time="${totalTime}"${timestamp}>\n`;

  if (results.suiteRun?.cancelled || results.load) {
    xml += `    <properties>\n`;
    if (results.suiteRun?.cancelled) {
      xml += `        <property name="cancelled" value="true"/>\n`;
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
          xml += `        <property name="${escapeXml(name)}" value="${escapeXml(String(value))}"/>\n`;
        }
      }
    }
    xml += `    </properties>\n`;
  }

  for (let i = 0; i < runs.length; i++) {
    xml += buildTestsuite(runs[i], i);
  }

  xml += `</testsuites>\n`;
  return xml;
}
