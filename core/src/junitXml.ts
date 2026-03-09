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

function buildTestcase(step: TestStepResult, classname: string): string {
  const name = escapeXml(step.title || `step-${step.stepIndex}`);
  const time = formatTime(step.durationMs);
  if (step.status === 'passed') {
    return `      <testcase name="${name}" classname="${classname}" time="${time}"/>\n`;
  }
  const parts: string[] = [];
  if (step.expected != null) {
    parts.push(`expected: ${step.expected}`);
  }
  if (step.actual != null) {
    parts.push(`actual: ${step.actual}`);
  }
  if (step.comparison) {
    parts.push(`operator: ${step.comparison}`);
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
  const tests = run.steps.length;
  const failures = run.steps.filter(s => s.status === 'failed').length;
  const time = formatTime(run.durationMs);
  const file = run.filePath ? ` file="${escapeXml(run.filePath)}"` : '';
  const timestamp = run.steps.length > 0 ? ` timestamp="${isoTimestamp(run.steps[0].timestamp)}"` : '';

  let xml = `    <testsuite name="${name}" tests="${tests}" failures="${failures}" errors="0" skipped="0" time="${time}"${file}${timestamp}>\n`;
  for (const step of run.steps) {
    xml += buildTestcase(step, classname);
  }
  xml += `    </testsuite>\n`;
  return xml;
}

export function generateJunitXml(results: CollectedResults, options?: JunitXmlOptions): string {
  const runs = results.testRuns;
  const suiteName = escapeXml(options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report');
  const totalTests = runs.reduce((sum, r) => sum + r.steps.length, 0);
  const totalFailures = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'failed').length, 0);
  const totalTime = formatTime(results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0));
  const timestamp = results.suiteRun?.startedAt
    ? ` timestamp="${isoTimestamp(results.suiteRun.startedAt)}"`
    : '';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites name="${suiteName}" tests="${totalTests}" failures="${totalFailures}" errors="0" skipped="0" time="${totalTime}"${timestamp}>\n`;

  if (results.suiteRun?.cancelled) {
    xml += `    <properties>\n`;
    xml += `        <property name="cancelled" value="true"/>\n`;
    xml += `    </properties>\n`;
  }

  for (let i = 0; i < runs.length; i++) {
    xml += buildTestsuite(runs[i], i);
  }

  xml += `</testsuites>\n`;
  return xml;
}
