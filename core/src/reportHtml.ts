import type { CollectedResults, TestRunResult, TestStepResult } from './reportCollector';

export interface ReportHtmlOptions {
  suiteName?: string;
  theme?: 'dark' | 'light' | 'auto';
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]
  );
}

function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) {
    return '0.000s';
  }
  return (ms / 1000).toFixed(3) + 's';
}

function buildStepHtml(step: TestStepResult): string {
  const name = escapeHtml(step.title || `step-${step.stepIndex}`);
  const duration = step.durationMs != null ? ` <span class="duration">(${formatDuration(step.durationMs)})</span>` : '';
  const icon = step.status === 'passed' ? '✓' : '✗';

  if (step.status === 'passed') {
    return `        <div class="testcase passed">${icon} ${name}${duration}</div>\n`;
  }

  let failureHtml = '          <div class="failure">\n';
  if (step.expected != null) {
    failureHtml += `            <div><strong>Expected:</strong> ${escapeHtml(String(step.expected))}</div>\n`;
  }
  if (step.actual != null) {
    failureHtml += `            <div><strong>Actual:</strong> ${escapeHtml(String(step.actual))}</div>\n`;
  }
  if (step.comparison) {
    failureHtml += `            <div><strong>Operator:</strong> ${escapeHtml(step.comparison)}</div>\n`;
  }
  failureHtml += '          </div>\n';

  return (
    `        <div class="testcase failed">${icon} ${name}${duration}\n` +
    failureHtml +
    `        </div>\n`
  );
}

function buildSuiteSection(run: TestRunResult, index: number): string {
  const name = escapeHtml(run.displayName || run.filePath || `test-${index}`);
  const failCount = run.steps.filter(s => s.status === 'failed').length;
  const badge = failCount > 0
    ? ` <span class="badge failed">${failCount} failed</span>`
    : ` <span class="badge passed">all passed</span>`;

  let html = `      <section class="suite">\n`;
  html += `        <h2>${name}${badge}</h2>\n`;
  for (const step of run.steps) {
    html += buildStepHtml(step);
  }
  if (run.steps.length === 0) {
    html += `        <div class="empty">No test steps</div>\n`;
  }
  html += `      </section>\n`;
  return html;
}

const CSS = `
    :root {
      --bg: #ffffff;
      --fg: #1a1a1a;
      --card: #f5f5f5;
      --border: #e0e0e0;
      --passed: #22863a;
      --failed: #cb2431;
      --muted: #6a737d;
      --accent: #0366d6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --fg: #c9d1d9;
        --card: #161b22;
        --border: #30363d;
        --passed: #3fb950;
        --failed: #f85149;
        --muted: #8b949e;
        --accent: #58a6ff;
      }
    }
    body.theme-dark {
      --bg: #0d1117;
      --fg: #c9d1d9;
      --card: #161b22;
      --border: #30363d;
      --passed: #3fb950;
      --failed: #f85149;
      --muted: #8b949e;
      --accent: #58a6ff;
    }
    body.theme-light {
      --bg: #ffffff;
      --fg: #1a1a1a;
      --card: #f5f5f5;
      --border: #e0e0e0;
      --passed: #22863a;
      --failed: #cb2431;
      --muted: #6a737d;
      --accent: #0366d6;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.5;
      padding: 2rem;
    }
    .report-container { max-width: 900px; margin: 0 auto; }
    header { margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .summary { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.95rem; }
    .summary .passed { color: var(--passed); font-weight: 600; }
    .summary .failed { color: var(--failed); font-weight: 600; }
    .summary .total { color: var(--muted); }
    .summary .duration { color: var(--muted); }
    .suite {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 1rem;
      padding: 1rem;
    }
    .suite h2 { font-size: 1.1rem; margin-bottom: 0.75rem; }
    .badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
    }
    .badge.passed { background: var(--passed); color: #fff; }
    .badge.failed { background: var(--failed); color: #fff; }
    .testcase {
      padding: 0.35rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.25rem;
      font-size: 0.9rem;
    }
    .testcase.passed { color: var(--passed); }
    .testcase.failed { color: var(--failed); }
    .failure {
      margin: 0.5rem 0 0.25rem 1.5rem;
      padding: 0.5rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.85rem;
      color: var(--fg);
    }
    .failure strong { color: var(--muted); }
    .duration { color: var(--muted); font-size: 0.85rem; }
    .empty { color: var(--muted); font-style: italic; font-size: 0.85rem; }
    footer {
      margin-top: 2rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.8rem;
    }
`;

export function generateReportHtml(results: CollectedResults, options?: ReportHtmlOptions): string {
  const runs = results.testRuns;
  const suiteName = escapeHtml(options?.suiteName || results.suiteRun?.suitePath || 'multimeter');
  const totalTests = runs.reduce((sum, r) => sum + r.steps.length, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'passed').length, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.steps.filter(s => s.status === 'failed').length, 0);
  const totalTime = formatDuration(
    results.suiteRun?.durationMs ?? runs.reduce((sum, r) => sum + (r.durationMs || 0), 0)
  );

  const theme = options?.theme || 'auto';
  const bodyClass = theme === 'auto' ? '' : ` class="theme-${theme}"`;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report — ${suiteName}</title>
  <style>${CSS}
  </style>
</head>
<body${bodyClass}>
  <div class="report-container">
    <header>
      <h1>${suiteName}</h1>
      <div class="summary">
        <span class="passed">${totalPassed} passed</span>
        <span class="failed">${totalFailed} failed</span>
        <span class="total">${totalTests} tests</span>
        <span class="duration">${totalTime}</span>
      </div>
    </header>\n`;

  for (let i = 0; i < runs.length; i++) {
    html += buildSuiteSection(runs[i], i);
  }

  html += `    <footer>Powered by Multimeter</footer>
  </div>
</body>
</html>\n`;

  return html;
}
