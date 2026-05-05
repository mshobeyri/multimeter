import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import { formatDuration } from './CommonData';

export interface ReportMarkdownOptions {
  suiteName?: string;
  includeDetails?: boolean;
}

interface ParsedCallDetails {
  request?: { method?: string; url?: string; body?: string };
  response?: { status?: number; statusText?: string; body?: string };
}

function tryFormatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function parseStepCallDetails(details?: string): ParsedCallDetails | null {
  if (!details || typeof details !== 'string') { return null; }
  try {
    const parsed = JSON.parse(details);
    if (!parsed || typeof parsed !== 'object') { return null; }
    const underscore = parsed['_'];
    if (!underscore || typeof underscore !== 'object' || typeof underscore.details !== 'string') { return null; }
    const inner = JSON.parse(underscore.details);
    if (!inner || typeof inner !== 'object') { return null; }
    return {
      request: inner.request,
      response: inner.response,
    };
  } catch {
    return null;
  }
}

function escapeMdTable(s: string): string {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildStepRow(step: TestStepResult, index: number): string {
  const name = escapeMdTable(step.title || `step-${step.stepIndex}`);
  const icon = step.status === 'passed' ? '✓' : '✗';
  const result = `${icon} ${step.status}`;
  return `| ${index + 1} | ${name} | ${step.stepType} | ${result} |`;
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

function buildFailureDetails(step: TestStepResult): string {
  const name = step.title || `step-${step.stepIndex}`;
  let md = `\n<details>\n<summary>✗ ${name}</summary>\n\n`;
  const expects = step.expects || [];
  if (expects.length > 0) {
    for (const e of expects) {
      const eIcon = e.status === 'passed' ? '✓' : '✗';
      md += `- ${eIcon} ${e.comparison}`;
      if (e.status === 'failed' && e.actual != null && e.expected != null) {
        md += `\n  - got: ${displayValue(e.actual)}`;
      }
      md += '\n';
    }
  }
  // Include request/response details for failed tests
  const reqResp = parseStepCallDetails(step.details);
  if (reqResp?.request) {
    const req = reqResp.request;
    md += `\n**Request:**\n`;
    if (req.method && req.url) {
      md += `\`${req.method} ${req.url}\`\n`;
    }
    if (req.body) {
      md += `\n\`\`\`json\n${tryFormatJson(req.body)}\n\`\`\`\n`;
    }
  }
  if (reqResp?.response) {
    const resp = reqResp.response;
    md += `\n**Response:**\n`;
    if (resp.status !== undefined) {
      md += `Status: ${resp.status}${resp.statusText ? ' ' + resp.statusText : ''}\n`;
    }
    if (resp.body) {
      md += `\n\`\`\`json\n${tryFormatJson(resp.body)}\n\`\`\`\n`;
    }
  }
  md += `\n</details>\n`;
  return md;
}

function buildSuiteSection(run: TestRunResult, index: number, includeDetails: boolean): string {
  const name = run.displayName || run.filePath || `test-${index}`;
  const steps = run.steps.filter(s => s.stepType !== 'debug');
  let md = `\n## ${name}\n\n`;
  md += `| # | Test | Type | Result |\n`;
  md += `|---|------|------|--------|\n`;
  for (let i = 0; i < steps.length; i++) {
    md += buildStepRow(steps[i], i) + '\n';
  }
  if (steps.length === 0) {
    md += `| | *No test steps* | | |\n`;
  }

  if (includeDetails) {
    const failedSteps = steps.filter(s => s.status === 'failed');
    for (const step of failedSteps) {
      md += buildFailureDetails(step);
    }
  }

  return md;
}

function buildLoadSection(results: CollectedResults): string {
  const load = results.load;
  if (!load) {
    return '';
  }
  let md = `\n## Load Metrics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  const rows = [
    ['Threads', load.config?.threads],
    ['Repeat', load.config?.repeat],
    ['Ramp-up', load.config?.rampup],
    ['Requests sent', load.summary?.requests],
    ['Succeeded', load.summary?.successes],
    ['Failed', load.summary?.failures],
    ['Success rate', load.summary?.success_rate != null ? `${(load.summary.success_rate * 100).toFixed(2)}%` : undefined],
    ['Failed rate', load.summary?.failed_rate != null ? `${(load.summary.failed_rate * 100).toFixed(2)}%` : undefined],
    ['Throughput', load.summary?.throughput != null ? `${load.summary.throughput} req/s` : undefined],
    ['Error rate', load.summary?.error_rate != null ? `${(load.summary.error_rate * 100).toFixed(2)}%` : undefined],
    ['Latency p95', load.latency?.p95 != null ? `${load.latency.p95} ms` : undefined],
    ['Latency p99', load.latency?.p99 != null ? `${load.latency.p99} ms` : undefined],
  ] as Array<[string, any]>;
  for (const [name, value] of rows) {
    if (value !== undefined && value !== null && value !== '') {
      md += `| ${escapeMdTable(name)} | ${escapeMdTable(String(value))} |\n`;
    }
  }
  if (load.thresholds && load.thresholds.length > 0) {
    md += `\n### Thresholds\n\n| Name | Expression | Actual | Result |\n|------|------------|--------|--------|\n`;
    for (const threshold of load.thresholds) {
      md += `| ${escapeMdTable(threshold.name)} | ${escapeMdTable(threshold.expression || '')} | ${threshold.actual ?? ''} | ${threshold.result} |\n`;
    }
  }
  if (load.errors && load.errors.length > 0) {
    md += `\n### Errors\n\n| Message | Count | Rate |\n|---------|-------|------|\n`;
    for (const err of load.errors) {
      md += `| ${escapeMdTable(err.message)} | ${err.count} | ${err.rate ?? ''} |\n`;
    }
  }
  return md;
}

export function generateReportMarkdown(results: CollectedResults, options?: ReportMarkdownOptions): string {
  const runs = results.testRuns;
  const suiteName = options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report';
  const includeDetails = options?.includeDetails !== false;
  const totalTests = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug').length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'failed').length, 0);
  const totalTime = formatDuration(
    results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );

  let md = `# Test Report: ${suiteName}\n\n`;

  if (results.suiteRun?.startedAt) {
    md += `**Timestamp:** ${new Date(results.suiteRun.startedAt).toISOString()}  \n`;
  }
  md += `**Duration:** ${totalTime}  \n`;
  md += `**Result:** ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total\n`;

  if (results.suiteRun?.cancelled) {
    md += `\n> ⚠ **Run was cancelled**\n`;
  }

  md += buildLoadSection(results);

  for (let i = 0; i < runs.length; i++) {
    md += buildSuiteSection(runs[i], i, includeDetails);
  }

  md += `\n---\n*Generated by Multimeter*\n`;
  return md;
}
