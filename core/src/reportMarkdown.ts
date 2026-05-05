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
  return `| ${index + 1} | ${name} | ${result} |`;
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

function buildTestRunSection(run: TestRunResult, index: number, includeDetails: boolean): string {
  const name = run.displayName || run.filePath || `test-${index}`;
  const steps = run.steps.filter(s => s.stepType !== 'debug');
  const icon = run.result === 'passed' ? '✓' : '✗';
  let md = `**${icon} ${name}** ${run.result}\n`;
  if (steps.length === 0) {
    return md;
  }
  md += `\n| # | Check | Result|\n`;
  md += `|---|------|--------|\n`;
  for (let i = 0; i < steps.length; i++) {
    md += buildStepRow(steps[i], i) + '\n';
  }

  if (includeDetails) {
    const failedSteps = steps.filter(s => s.status === 'failed');
    for (const step of failedSteps) {
      md += buildFailureDetails(step);
    }
  }

  return md;
}

function buildFunctionalTestsSection(runs: TestRunResult[], includeDetails: boolean): string {
  let md = `\n## Tests\n`;
  if (runs.length === 0) {
    return md + `\n*No test results in this report.*\n`;
  }
  for (let i = 0; i < runs.length; i++) {
    md += buildTestRunSection(runs[i], i, includeDetails);
    if (i < runs.length - 1) {
      md += '\n';
    }
  }
  return md;
}

function getLoadPoints(results: CollectedResults): Array<{at: number; active_threads?: number; requests?: number; errors?: number; throughput?: number; response_time?: number; error_rate?: number}> {
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
    return {...point, at};
  });
}

function buildLoadSection(results: CollectedResults): string {
  const load = results.load;
  if (!load) {
    return '';
  }
  const loadData = load;
  let md = `\n## Load Metrics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  const rows = [
    ['Threads', loadData.config?.threads],
    ['Repeat', loadData.config?.repeat],
    ['Ramp-up', loadData.config?.rampup],
    ['Requests sent', loadData.summary?.requests],
    ['Succeeded', loadData.summary?.successes],
    ['Failed', loadData.summary?.failures],
    ['Success rate', loadData.summary?.success_rate != null ? `${(loadData.summary.success_rate * 100).toFixed(2)}%` : undefined],
    ['Failed rate', loadData.summary?.failed_rate != null ? `${(loadData.summary.failed_rate * 100).toFixed(2)}%` : undefined],
    ['Throughput', loadData.summary?.throughput != null ? `${loadData.summary.throughput} req/s` : undefined],
    ['Error rate', loadData.summary?.error_rate != null ? `${(loadData.summary.error_rate * 100).toFixed(2)}%` : undefined],
    ['Latency p95', loadData.latency?.p95 != null ? `${loadData.latency.p95} ms` : undefined],
    ['Latency p99', loadData.latency?.p99 != null ? `${loadData.latency.p99} ms` : undefined],
  ] as Array<[string, any]>;
  for (const [name, value] of rows) {
    if (value !== undefined && value !== null && value !== '') {
      md += `| ${escapeMdTable(name)} | ${escapeMdTable(String(value))} |\n`;
    }
  }
  const points = getLoadPoints(results);
  if (points.length > 0) {
    md += buildLoadMermaidCharts(points);
    md += `\n### Snapshots\n\n| At | Threads | Requests | Requests/sec | Response time | Failures | Failure rate |\n|----|---------|----------|--------------|---------------|----------|--------------|\n`;
    for (const point of points) {
      md += `| ${point.at} | ${point.active_threads ?? ''} | ${point.requests ?? ''} | ${point.throughput != null ? point.throughput.toFixed(2) : ''} | ${point.response_time != null ? point.response_time.toFixed(2) : ''} | ${point.errors ?? ''} | ${point.error_rate != null ? `${(point.error_rate * 100).toFixed(2)}%` : ''} |\n`;
    }
  }
  if (loadData.thresholds && loadData.thresholds.length > 0) {
    md += `\n### Thresholds\n\n| Name | Expression | Actual | Result |\n|------|------------|--------|--------|\n`;
    for (const threshold of loadData.thresholds) {
      md += `| ${escapeMdTable(threshold.name)} | ${escapeMdTable(threshold.expression || '')} | ${threshold.actual ?? ''} | ${threshold.result} |\n`;
    }
  }
  if (loadData.errors && loadData.errors.length > 0) {
    md += `\n### Errors\n\n| Message | Count | Rate |\n|---------|-------|------|\n`;
    for (const err of loadData.errors) {
      md += `| ${escapeMdTable(err.message)} | ${err.count} | ${err.rate ?? ''} |\n`;
    }
  }
  return md;
}

function mermaidValues(values: number[]): string {
  return values.map(value => Number.isFinite(value) ? Number(value.toFixed(2)) : 0).join(', ');
}

function buildLoadMermaidChart(title: string, yAxis: string, labels: string[], values: number[]): string {
  const maxY = Math.max(1, ...values);
  return `\n\`\`\`mermaid\nxychart\n    title "${title}"\n    x-axis [${labels.join(', ')}]\n    y-axis "${yAxis}" 0 --> ${Math.ceil(maxY)}\n    line [${mermaidValues(values)}]\n\`\`\`\n`;
}

function buildLoadMermaidCharts(series: ReturnType<typeof getLoadPoints>): string {
  const labels = series.map(point => String(point.at));
  const throughput = series.map(point => Number(point.throughput || 0));
  const responseTime = series.map(point => Number(point.response_time || 0));
  const failures = series.map(point => Number(point.errors || 0));
  const threads = series.map(point => Number(point.active_threads || 0));
  return `\n### Charts\n` +
    buildLoadMermaidChart('Requests/sec over time', 'Requests/sec', labels, throughput) +
    buildLoadMermaidChart('Response time over time', 'Milliseconds', labels, responseTime) +
    buildLoadMermaidChart('Failures over time', 'Failures', labels, failures) +
    buildLoadMermaidChart('Threads over time', 'Threads', labels, threads);
}

export function generateReportMarkdown(results: CollectedResults, options?: ReportMarkdownOptions): string {
  const runs = results.testRuns;
  const suiteName = options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report';
  const includeDetails = options?.includeDetails !== false;
  const isLoad = results.type === 'loadtest' || !!results.load;
  const totalTests = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug').length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'failed').length, 0);
  const totalTime = formatDuration(
    results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );

  let md = `# Test Report: ${suiteName}\n\n`;

  md += `## Overview\n\n`;

  if (results.suiteRun?.startedAt) {
    md += `**Timestamp:** ${new Date(results.suiteRun.startedAt).toISOString()}  \n`;
  }
  md += `**Duration:** ${totalTime}  \n`;
  if (isLoad) {
    const summary = results.load?.summary;
    md += `**Result:** ${summary?.successes ?? 0} passed, ${summary?.failures ?? 0} failed, ${summary?.requests ?? summary?.iterations ?? 0} requests\n`;
  } else {
    md += `**Result:** ${totalPassed} passed, ${totalFailed} failed, ${totalTests} total checks\n`;
  }

  if (results.suiteRun?.cancelled) {
    md += `\n> ⚠ **Run was cancelled**\n`;
  }

  md += buildLoadSection(results);

  if (!isLoad) {
    md += buildFunctionalTestsSection(runs, includeDetails);
  }

  md += `\n---\n*Generated by **Multimeter***\n`;
  return md;
}
