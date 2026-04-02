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
  let md = `\n## ${name}\n\n`;
  md += `| # | Test | Type | Result |\n`;
  md += `|---|------|------|--------|\n`;
  for (let i = 0; i < run.steps.length; i++) {
    md += buildStepRow(run.steps[i], i) + '\n';
  }
  if (run.steps.length === 0) {
    md += `| | *No test steps* | | |\n`;
  }

  if (includeDetails) {
    const failedSteps = run.steps.filter(s => s.status === 'failed');
    for (const step of failedSteps) {
      md += buildFailureDetails(step);
    }
  }

  return md;
}

export function generateReportMarkdown(results: CollectedResults, options?: ReportMarkdownOptions): string {
  const runs = results.testRuns;
  const suiteName = options?.suiteName || results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || results.testRuns[0]?.displayName || 'Test Report';
  const includeDetails = options?.includeDetails !== false;
  const totalTests = runs.reduce((sum, r) => sum + r.steps.length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'failed').length, 0);
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

  for (let i = 0; i < runs.length; i++) {
    md += buildSuiteSection(runs[i], i, includeDetails);
  }

  md += `\n---\n*Generated by Multimeter*\n`;
  return md;
}
