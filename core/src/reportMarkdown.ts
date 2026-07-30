import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';
import { formatDuration } from './CommonData';
import { beautifyWithContentType } from './markupConvertor';
import { isOmitSentinel, OMIT_KEYWORD, restoreOmitKeywordInText } from './omitKeyword';
import {formatReportDateTime, formatReportNumber, formatReportPercent} from './reportFormat';

export interface ReportMarkdownOptions {
  suiteName?: string;
  /** Include failure / similarity / count <details> under the Tests table (default true). */
  includeDetails?: boolean;
  /**
   * Append a full Step Details section for every step that has call IO
   * (request/response), attached after the normal Markdown report.
   */
  includeFullDetails?: boolean;
}

interface ParsedCallDetails {
  stepKind?: string;
  statusCode?: number;
  request?: {
    method?: string;
    url?: string;
    body?: any;
    headers?: Record<string, any>;
    query?: Record<string, any>;
  };
  response?: {
    status?: number;
    statusText?: string;
    body?: any;
    headers?: Record<string, any>;
    duration?: number;
  };
  outputs?: Record<string, any>;
}

type ReportBodyFormat = 'json' | 'xml' | 'urlencoded' | 'text';

function headerValue(
  headers: Record<string, any> | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value == null ? undefined : String(value);
    }
  }
  return undefined;
}

/** Infer body format from Content-Type and/or body text (same rules as the report panel). */
function detectBodyFormat(
  body: string,
  headers?: Record<string, any>,
): ReportBodyFormat {
  const contentType = (headerValue(headers, 'content-type') || '').toLowerCase();
  if (contentType.includes('json')) {
    return 'json';
  }
  if (contentType.includes('xml') || contentType.includes('html')) {
    return 'xml';
  }
  if (contentType.includes('urlencoded') || contentType.includes('x-www-form-urlencoded')) {
    return 'urlencoded';
  }

  const trimmed = (body || '').trimStart();
  if (!trimmed) {
    return 'text';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(body);
      return 'json';
    } catch {
      // fall through
    }
  }
  if (trimmed.startsWith('<')) {
    return 'xml';
  }
  if (/^[^=&\s]+=/.test(trimmed) && trimmed.includes('=') && !trimmed.includes('\n')) {
    return 'urlencoded';
  }
  return 'text';
}

function prettyUrlEncoded(body: string): string {
  return body
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) {
        return decodeURIComponent(part.replace(/\+/g, ' '));
      }
      const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
      const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
      return `${key}=${value}`;
    })
    .join('&\n');
}

function formatBodyValue(value: any, headers?: Record<string, any>): {
  text: string;
  format: ReportBodyFormat;
} {
  if (value === null || value === undefined) {
    return { text: '', format: 'text' };
  }
  if (typeof value !== 'string') {
    try {
      return { text: JSON.stringify(value, null, 2), format: 'json' };
    } catch {
      return { text: String(value), format: 'text' };
    }
  }
  const format = detectBodyFormat(value, headers);
  const contentType = headerValue(headers, 'content-type') || '';
  if (format === 'urlencoded') {
    try {
      return { text: prettyUrlEncoded(value), format };
    } catch {
      return { text: value, format };
    }
  }
  return { text: beautifyWithContentType(contentType, value), format };
}

function fenceLangFor(format: ReportBodyFormat): string {
  if (format === 'json') {
    return 'json';
  }
  if (format === 'xml') {
    return 'xml';
  }
  return '';
}

function tryFormatJson(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  const s = value;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function hasEntries(value: Record<string, any> | undefined): boolean {
  return !!value && typeof value === 'object' && Object.keys(value).length > 0;
}

function parseStepCallDetails(details?: string): ParsedCallDetails | null {
  if (!details || typeof details !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(details);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const underscore = parsed['_'];
    if (!underscore || typeof underscore !== 'object') {
      return null;
    }
    if (typeof underscore.details !== 'string' && underscore.status === undefined) {
      return null;
    }
    const result: ParsedCallDetails = {};
    if (typeof underscore.stepKind === 'string') {
      result.stepKind = underscore.stepKind;
    }
    if (underscore.status !== undefined) {
      result.statusCode = underscore.status;
    }
    if (typeof underscore.details === 'string') {
      try {
        const inner = JSON.parse(underscore.details);
        if (inner && typeof inner === 'object') {
          if (typeof (inner as any).stepKind === 'string') {
            result.stepKind = (inner as any).stepKind;
          }
          if (inner.request) {
            result.request = inner.request;
          }
          if (inner.response) {
            result.response = inner.response;
          }
        }
      } catch {
        /* ignore nested parse failure */
      }
    }
    const reportOutputKeys = Array.isArray((underscore as any).reportOutputKeys)
      ? new Set((underscore as any).reportOutputKeys.filter((key: any) => typeof key === 'string'))
      : null;
    const outputs: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k !== '_' && (!reportOutputKeys || reportOutputKeys.has(k))) {
        outputs[k] = v;
      }
    }
    if (Object.keys(outputs).length > 0) {
      result.outputs = outputs;
    }
    if (!result.request && !result.response && result.statusCode === undefined && !result.outputs) {
      return null;
    }
    return result;
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
  if (isOmitSentinel(v)) {
    return OMIT_KEYWORD;
  }
  if (typeof v === 'object') {
    try {
      return restoreOmitKeywordInText(JSON.stringify(v));
    } catch {
      return String(v);
    }
  }
  return restoreOmitKeywordInText(String(v));
}

function stepHasSimilarity(step: TestStepResult): boolean {
  return (step.expects || []).some(e => typeof e.similarity === 'number');
}

function stepHasCount(step: TestStepResult): boolean {
  return (step.expects || []).some(e => typeof e.count === 'number');
}

function buildKvTable(entries: Record<string, any>): string {
  let md = `| Key | Value |\n|-----|-------|\n`;
  for (const [k, v] of Object.entries(entries)) {
    md += `| ${escapeMdTable(k)} | ${escapeMdTable(displayValue(v))} |\n`;
  }
  return md;
}

function buildBodyBlock(value: any, headers?: Record<string, any>): string {
  const { text, format } = formatBodyValue(value, headers);
  const lang = fenceLangFor(format);
  return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
}

function buildStepDetails(step: TestStepResult): string {
  const name = step.title || `step-${step.stepIndex}`;
  const stepIcon = step.status === 'passed' ? '✓' : '✗';
  let md = `\n<details>\n<summary>${stepIcon} ${name}</summary>\n\n`;
  const expects = step.expects || [];
  if (expects.length > 0) {
    for (const e of expects) {
      const eIcon = e.status === 'passed' ? '✓' : '✗';
      md += `- ${eIcon} ${e.comparison}`;
      if ((e.status === 'failed' || typeof e.similarity === 'number' || typeof e.count === 'number') && e.actual != null && e.expected != null) {
        md += `\n  - got: ${displayValue(e.actual)}`;
        if (typeof e.similarity === 'number') {
          md += `\n  - similarity: ${e.similarity}%`;
        }
        if (typeof e.count === 'number') {
          md += `\n  - count: ${e.count}`;
        }
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
    if (hasEntries(req.headers)) {
      md += `\nHeaders:\n\n\`\`\`json\n${tryFormatJson(req.headers)}\n\`\`\`\n`;
    }
    if (req.body) {
      md += buildBodyBlock(req.body, req.headers);
    }
  }
  if (reqResp?.response) {
    const resp = reqResp.response;
    md += `\n**Response:**\n`;
    if (resp.status !== undefined) {
      md += `Status: ${resp.status}${resp.statusText ? ' ' + resp.statusText : ''}\n`;
    }
    if (hasEntries(resp.headers)) {
      md += `\nHeaders:\n\n\`\`\`json\n${tryFormatJson(resp.headers)}\n\`\`\`\n`;
    }
    if (resp.body) {
      md += buildBodyBlock(resp.body, resp.headers);
    }
  }
  md += `\n</details>\n`;
  return md;
}

function mdHeading(level: number, text: string): string {
  const hashes = '#'.repeat(Math.max(1, Math.min(level, 6)));
  return `${hashes} ${text}`;
}

/** Full step IO matching the report panel (request + response). */
function buildFullStepCallDetails(
  step: TestStepResult,
  call: ParsedCallDetails,
  stepHeadingLevel: number,
): string {
  const name = step.title || `step-${step.stepIndex}`;
  const stepIcon = step.status === 'passed' ? '✓' : '✗';
  const sectionLevel = stepHeadingLevel + 1;
  let md = `\n${mdHeading(stepHeadingLevel, `${stepIcon} ${name}`)}\n\n`;

  if (call.request) {
    const req = call.request;
    md += `${mdHeading(sectionLevel, 'Request')}\n\n`;
    if (req.method || req.url) {
      const method = (req.method || '').toUpperCase();
      const url = req.url || '';
      md += `\`${method}${method && url ? ' ' : ''}${url}\`\n\n`;
    }
    if (hasEntries(req.headers)) {
      md += `**Headers**\n\n`;
      md += buildKvTable(req.headers!);
      md += `\n`;
    }
    if (req.body !== undefined && req.body !== null && req.body !== '') {
      md += `**Body**\n`;
      md += buildBodyBlock(req.body, req.headers);
      md += `\n`;
    }
  }

  if (call.response || call.statusCode !== undefined) {
    const resp = call.response || {};
    md += `${mdHeading(sectionLevel, 'Response')}\n\n`;
    const status = call.statusCode ?? resp.status;
    if (status !== undefined) {
      const statusText = resp.statusText ? ` ${resp.statusText}` : '';
      const duration = resp.duration !== undefined ? ` (${resp.duration}ms)` : '';
      md += `**Status:** \`${status}${statusText}${duration}\`\n\n`;
    }
    if (hasEntries(resp.headers)) {
      md += `**Headers**\n\n`;
      md += buildKvTable(resp.headers!);
      md += `\n`;
    }
    if (resp.body !== undefined && resp.body !== null && resp.body !== '') {
      md += `**Body**\n`;
      md += buildBodyBlock(resp.body, resp.headers);
      md += `\n`;
    }
  }

  return md;
}

function buildFullDetailsSection(runs: TestRunResult[]): string {
  let md = `\n## Step Details\n`;
  let wroteAny = false;
  const multiRun = runs.length > 1;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const steps = run.steps.filter(s => s.stepType !== 'debug');
    const withDetails = steps
      .map(step => ({ step, call: parseStepCallDetails(step.details) }))
      .filter((item): item is { step: TestStepResult; call: ParsedCallDetails } => !!item.call);
    if (withDetails.length === 0) {
      continue;
    }
    wroteAny = true;
    if (multiRun) {
      const name = run.displayName || run.filePath || `test-${i}`;
      md += `\n### ${name}\n`;
    }
    const stepHeadingLevel = multiRun ? 4 : 3;
    for (const { step, call } of withDetails) {
      md += buildFullStepCallDetails(step, call, stepHeadingLevel);
    }
  }
  if (!wroteAny) {
    return md + `\n*No call details available in this report.*\n`;
  }
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
    const detailedSteps = steps.filter(s => s.status === 'failed' || stepHasSimilarity(s) || stepHasCount(s));
    for (const step of detailedSteps) {
      md += buildStepDetails(step);
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
  const startedAt = results.suiteRun?.startedAt ?? loadData.config?.started_at;
  const endedAt = results.suiteRun?.finishedAt ?? loadData.config?.finished_at;
  let md = `\n## Load Metrics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  const rows = [
    ['Started at', formatReportDateTime(startedAt)],
    ['Ended at', formatReportDateTime(endedAt)],
    ['Threads', loadData.config?.threads],
    ['Repeat', loadData.config?.repeat],
    ['Ramp-up', loadData.config?.rampup],
    ['Requests sent', loadData.summary?.requests],
    ['Succeeded', loadData.summary?.successes],
    ['Failed', loadData.summary?.failures],
    ['Success rate', loadData.summary?.success_rate != null ? formatReportPercent(loadData.summary.success_rate) : undefined],
    ['Failed rate', loadData.summary?.failed_rate != null ? formatReportPercent(loadData.summary.failed_rate) : undefined],
    ['Throughput', loadData.summary?.throughput != null ? `${formatReportNumber(loadData.summary.throughput)} req/s` : undefined],
    ['Error rate', loadData.summary?.error_rate != null ? formatReportPercent(loadData.summary.error_rate) : undefined],
    ['Latency p95', loadData.latency?.p95 != null ? `${formatReportNumber(loadData.latency.p95)} ms` : undefined],
    ['Latency p99', loadData.latency?.p99 != null ? `${formatReportNumber(loadData.latency.p99)} ms` : undefined],
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
      md += `| ${point.at} | ${point.active_threads ?? ''} | ${point.requests ?? ''} | ${point.throughput != null ? formatReportNumber(point.throughput) : ''} | ${point.response_time != null ? formatReportNumber(point.response_time) : ''} | ${point.errors ?? ''} | ${point.error_rate != null ? formatReportPercent(point.error_rate) : ''} |\n`;
    }
  }
  if (loadData.thresholds && loadData.thresholds.length > 0) {
    md += `\n### Thresholds\n\n| Name | Expression | Actual | Result |\n|------|------------|--------|--------|\n`;
    for (const threshold of loadData.thresholds) {
      md += `| ${escapeMdTable(threshold.name)} | ${escapeMdTable(threshold.expression || '')} | ${typeof threshold.actual === 'number' ? formatReportNumber(threshold.actual) : threshold.actual ?? ''} | ${threshold.result} |\n`;
    }
  }
  if (loadData.errors && loadData.errors.length > 0) {
    md += `\n### Errors\n\n| Message | Count | Rate |\n|---------|-------|------|\n`;
    for (const err of loadData.errors) {
      md += `| ${escapeMdTable(err.message)} | ${err.count} | ${typeof err.rate === 'number' ? formatReportNumber(err.rate) : err.rate ?? ''} |\n`;
    }
  }
  return md;
}

function mermaidValues(values: number[]): string {
  return values.map(value => Number.isFinite(value) ? Number(formatReportNumber(value)) : 0).join(', ');
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
  const includeFullDetails = options?.includeFullDetails === true;
  const isLoad = results.type === 'loadtest' || !!results.load;
  const totalTests = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug').length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.stepType !== 'debug' && s.status === 'failed').length, 0);
  const totalTime = formatDuration(
    results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );
  const timestamp = results.suiteRun?.startedAt ?? results.load?.config?.started_at;
  const endedAt = results.suiteRun?.finishedAt ?? results.load?.config?.finished_at;

  let md = `# Test Report: ${suiteName}\n\n`;

  md += `## Overview\n\n`;

  if (timestamp) {
    md += `**Started at:** ${formatReportDateTime(timestamp)}  \n`;
  }
  if (endedAt) {
    md += `**Ended at:** ${formatReportDateTime(endedAt)}  \n`;
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
    if (includeFullDetails) {
      md += buildFullDetailsSection(runs);
    }
  }

  md += `\n---\n*Generated by **Multimeter***\n`;
  return md;
}

/** Convenience wrapper for the detailed Markdown export format. */
export function generateReportMarkdownDetailed(
  results: CollectedResults,
  options?: Omit<ReportMarkdownOptions, 'includeFullDetails'>,
): string {
  return generateReportMarkdown(results, { ...options, includeFullDetails: true });
}
