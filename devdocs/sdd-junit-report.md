# SDD: Test Report Generation

## Summary

Add test report generation to multimeter in four formats:

1. **JUnit XML** — the universal CI/CD standard, consumed natively by Azure Pipelines, GitHub Actions, GitLab CI, Jenkins, etc.
2. **MMT report (YAML)** — a multimeter-native YAML format that mirrors the JUnit structure but is human-readable, easy to diff, and consistent with the `.mmt` ecosystem.
3. **HTML report** — a self-contained HTML page with inline CSS, dark/light theme support, and visual pass/fail indicators. Shareable and viewable in any browser.
4. **Markdown report** — a lightweight text report suitable for pasting into PRs, issues, wikis, or README files.

## Motivation

Currently, `testlight` (the CLI) outputs a flat `Success: true/false` with error strings. The reporter callback in the CLI is a no-op — all per-step results are discarded. There is no way to:

- Integrate `.mmt` test results into CI/CD dashboards
- Get machine-readable structured output from test runs
- View historical pass/fail trends across pipeline runs
- Review test results in a format native to the `.mmt` ecosystem

JUnit XML is the universal standard for test result interchange. Every major CI/CD tool supports it natively. Adding this gives multimeter parity with Karate and Newman, and surpasses Bruno (which has no report output).

The MMT YAML report format complements JUnit XML by providing a YAML-native report that is easy to read, diff in pull requests, and parse with standard YAML tools — no XML parsing needed.

HTML and Markdown reports provide human-friendly outputs for sharing results with stakeholders, embedding in documentation, or reviewing in a browser — no CI/CD tooling or YAML/XML parsing required.

## Design

### Architecture overview

```
Entry point (CLI or webview)
  └─ reporter: collectingReporter (accumulates events)
       ├─ test-step events → accumulator.steps[]
       ├─ test-step-run events → accumulator.testRuns[]
       ├─ suite-item events → accumulator.suiteItems[]
       ├─ suite-run-start → accumulator.suiteStart
       └─ suite-run-finished → accumulator.suiteEnd
  └─ runner.runFile() → RunFileResult
  └─ serializer.generate(accumulator) → report string
  └─ output: fs.writeFile (CLI) or vscode.showSaveDialog (extension)
```

The implementation has six layers:

1. **Collecting reporter** (`core/`) — a reporter callback that accumulates structured events into a result tree instead of discarding them.
2. **Report serializers** (`core/`) — pure functions that take accumulated results and produce output strings. No `fs`, no side effects.
   - `junitXml.ts` → JUnit XML string
   - `mmtReport.ts` → MMT YAML string
   - `reportHtml.ts` → self-contained HTML string
   - `reportMarkdown.ts` → Markdown string
3. **CLI wiring** (`mmtcli/`) — a `--report <format>` flag that plugs the collecting reporter into the run, calls the appropriate serializer, and writes the file.
4. **Webview export buttons** (`mmtview/` + `src/`) — "Export Report" buttons on the test and suite run pages that send collected results to the extension host, which serializes and saves via a file dialog.
5. **Report viewer** (`mmtview/` + `src/`) — opening a `.mmt` file with `type: report` renders the results visually in a read-only panel, reusing the existing `TestStepReportPanel` component. Includes an Export button to re-export to any format.
6. **Documentation** (`docs/`) — user-facing docs for the CLI flags, report formats, CI/CD integration, the VS Code export buttons, and the report viewer.

### Layer 1: Collecting reporter

A new module `core/src/reportCollector.ts` that builds a structured result tree from reporter events.

#### Types

```typescript
interface TestStepResult {
  stepIndex: number;
  stepType: 'check' | 'assert';
  status: 'passed' | 'failed';
  title?: string;
  actual?: string;
  expected?: string;
  details?: string;
  operator?: string;
  durationMs?: number;
}

interface TestRunResult {
  runId: string;
  id?: string;            // suite bundle node id
  filePath?: string;
  displayName?: string;
  result: 'passed' | 'failed';
  durationMs?: number;
  steps: TestStepResult[];
  outputs?: Record<string, any>;
}

interface SuiteRunResult {
  runId: string;
  suitePath?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  success: boolean;
  cancelled?: boolean;
  totalRunnable: number;
  testRuns: TestRunResult[];
}

interface CollectedResults {
  type: 'test' | 'suite';
  suiteRun?: SuiteRunResult;
  testRuns: TestRunResult[];
}
```

#### Behavior

- `createReportCollector()` returns `{ reporter, getResults }`.
- `reporter` is a `(message: RunReporterMessage) => void` that routes events:
  - `scope: 'suite-run-start'` → initializes `SuiteRunResult`
  - `scope: 'suite-run-finished'` → finalizes `SuiteRunResult`
  - `scope: 'suite-item'` with `status: 'running'` → starts a new `TestRunResult`
  - `scope: 'suite-item'` with `status: 'passed' | 'failed'` → finalizes the `TestRunResult`
  - `scope: 'test-step'` → appends a `TestStepResult` to the current `TestRunResult` (matched by `runId` or `id`)
  - `scope: 'test-step-run'` → sets overall `result` on the `TestRunResult`
  - `scope: 'test-outputs'` → attaches outputs to the `TestRunResult`
- `getResults()` returns the `CollectedResults` after the run completes.

#### Matching events to test runs

Events are associated with test runs using `id` (suite bundle node id) when available, falling back to `runId`. The collector maintains a `Map<string, TestRunResult>` keyed by `id ?? runId`.

For standalone test runs (no suite), a single `TestRunResult` is created from the first `test-step` event's `runId`.

### Layer 2a: JUnit XML serializer

A new module `core/src/junitXml.ts` — a pure function, no dependencies on `fs` or `vscode`.

#### Mapping to JUnit XML

| Multimeter concept | JUnit XML element | Notes |
|---|---|---|
| Suite run | `<testsuites>` | Root element with aggregate counts |
| Test file run (`TestRunResult`) | `<testsuite>` | One per test file in the suite |
| Check/assert step (`TestStepResult`) | `<testcase>` | One per check/assert |
| Failed check/assert | `<failure>` child of `<testcase>` | Contains actual/expected/operator |
| Standalone test (no suite) | `<testsuites>` with single `<testsuite>` | Same structure, just one suite |

#### Output format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="suite-title" tests="12" failures="2" errors="0"
            skipped="0" time="3.456" timestamp="2026-03-06T10:30:00Z">
  <testsuite name="test-file.mmt" tests="4" failures="1" errors="0"
             skipped="0" time="1.234" file="path/to/test-file.mmt">
    <testcase name="status == 200" classname="test-file" time="0.100">
    </testcase>
    <testcase name="result.name == John" classname="test-file" time="0.050">
      <failure message="expected John got Jane" type="check">
actual: Jane
expected: John
operator: ==
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

#### Function signature

```typescript
function generateJunitXml(results: CollectedResults, options?: {
  suiteName?: string;     // override <testsuites name="">
}): string;
```

#### XML generation

Hand-built string concatenation (no XML library needed). The format is simple enough that template literals with proper escaping suffice. An `escapeXml()` helper handles `&`, `<`, `>`, `"`, `'`.

#### Attributes

- `tests`: total `<testcase>` count
- `failures`: count of `<testcase>` elements with a `<failure>` child
- `errors`: `0` (multimeter doesn't distinguish errors from failures at the step level; runtime exceptions that prevent a test from completing are reported as a `<testsuite>` with a single `<testcase>` containing an `<error>` element)
- `skipped`: `0` (no skip concept in the current reporter events; future-proofed in the type)
- `time`: duration in seconds (decimal)
- `timestamp`: ISO 8601 start time
- `file`: relative path to the `.mmt` file

### Layer 2b: MMT YAML report serializer

A new module `core/src/mmtReport.ts` — a pure function that takes the same `CollectedResults` and produces a YAML string. Uses the `yaml` library already available in core.

#### Output format

The MMT report is a YAML file with `type: report`, structurally parallel to JUnit XML but idiomatic YAML:

```yaml
type: report
name: suite-title
timestamp: 2026-03-06T10:30:00Z
duration: 3.456s
summary:
  tests: 12
  passed: 10
  failed: 2
  errors: 0
  skipped: 0
suites:
  - name: test-file.mmt
    file: path/to/test-file.mmt
    duration: 1.234s
    result: failed
    tests:
      - name: status == 200
        type: check
        result: passed
        duration: 0.100s
      - name: result.name == John
        type: check
        result: failed
        duration: 0.050s
        failure:
          message: expected John got Jane
          actual: Jane
          expected: John
          operator: "=="
  - name: another-test.mmt
    file: path/to/another-test.mmt
    duration: 2.222s
    result: passed
    tests:
      - name: response.items.length > 0
        type: assert
        result: passed
        duration: 0.080s
```

For a standalone test (no suite), the structure is the same but with a single entry in `suites`.

#### Mapping to structure

| Multimeter concept | YAML key | Notes |
|---|---|---|
| Suite run | root object | `type: report`, aggregate `summary` |
| Test file run (`TestRunResult`) | `suites[n]` | One per test file |
| Check/assert step (`TestStepResult`) | `suites[n].tests[m]` | One per check/assert |
| Failed step | `suites[n].tests[m].failure` | Object with `message`, `actual`, `expected`, `operator` |
| Runtime exception | `suites[n].tests[m].error` | Object with `message` and optional `stack` |

#### Function signature

```typescript
function generateMmtReport(results: CollectedResults, options?: {
  suiteName?: string;
}): string;
```

#### Design decisions

- **`type: report`** — consistent with the `.mmt` type system (`type: api`, `type: test`, `type: suite`, `type: env`). This makes report files recognizable and potentially openable in multimeter in the future.
- **Duration as string with `s` suffix** — human-readable (`1.234s`), consistent with how durations appear in `.mmt` files (e.g. `delay: 2s`). Parseable by stripping the suffix.
- **`result` field** instead of `status` — avoids ambiguity with HTTP status codes common in the `.mmt` context.
- **Flat `failure` object** — no nesting beyond one level. Keeps YAML clean and diffable.
- **File extension**: `.mmt` — consistent with all other multimeter file types (`api.mmt`, `test.mmt`, `suite.mmt`). The `type: report` field distinguishes report files. Default filename: `test-results.mmt`.

### Layer 2c: HTML report serializer

A new module `core/src/reportHtml.ts` — a pure function that takes `CollectedResults` and produces a self-contained HTML page. Follows the same pattern as `core/src/docHtml.ts` (the existing API doc HTML generator).

#### Output format

A single HTML file with:
- All CSS inline (no external stylesheets or CDN references)
- Dark/light theme toggle via CSS custom properties (reusing the existing `--fg`, `--bg`, `--card`, `--accent` variable scheme from `docHtml.ts`)
- Summary header with pass/fail/total counts and overall duration
- Collapsible test suite sections, each showing their test cases
- Failed test cases highlighted with actual/expected/operator details
- "Powered by Multimeter" footer
- System font stack for cross-platform rendering

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Report — suite-title</title>
  <style>
    /* inline CSS with dark/light theme variables */
  </style>
</head>
<body>
  <div class="report-container">
    <header>
      <h1>suite-title</h1>
      <div class="summary">
        <span class="passed">10 passed</span>
        <span class="failed">2 failed</span>
        <span class="total">12 tests</span>
        <span class="duration">3.456s</span>
      </div>
    </header>
    <section class="suite">
      <h2>test-file.mmt <span class="badge failed">1 failed</span></h2>
      <div class="testcase passed">✓ status == 200 (0.100s)</div>
      <div class="testcase failed">
        ✗ result.name == John (0.050s)
        <div class="failure">
          <div>Expected: John</div>
          <div>Actual: Jane</div>
        </div>
      </div>
    </section>
    <footer>Powered by Multimeter</footer>
  </div>
</body>
</html>
```

#### Function signature

```typescript
function generateReportHtml(results: CollectedResults, options?: {
  suiteName?: string;
  theme?: 'dark' | 'light' | 'auto';  // default: 'auto' (prefers-color-scheme)
}): string;
```

#### Design decisions

- **Self-contained** — no external dependencies. The HTML file can be emailed, attached to a ticket, or served from any static host.
- **Reuses CSS variable scheme** from existing `docHtml.ts` for visual consistency with API doc exports.
- **`escapeHtml()` helper** already exists in `docHtml.ts` — reuse it for safe rendering of user data.
- **No JavaScript required** — the page is pure HTML+CSS. Theme toggle uses `prefers-color-scheme` media query by default.

### Layer 2d: Markdown report serializer

A new module `core/src/reportMarkdown.ts` — a pure function that takes `CollectedResults` and produces a Markdown string.

#### Output format

```markdown
# Test Report: suite-title

**Timestamp:** 2026-03-06T10:30:00Z  
**Duration:** 3.456s  
**Result:** 10 passed, 2 failed, 12 total

## test-file.mmt

| # | Test | Type | Result | Duration |
|---|------|------|--------|----------|
| 1 | status == 200 | check | ✓ passed | 0.100s |
| 2 | result.name == John | check | ✗ failed | 0.050s |

<details>
<summary>✗ result.name == John</summary>

- **Expected:** John
- **Actual:** Jane
- **Operator:** ==

</details>

## another-test.mmt

| # | Test | Type | Result | Duration |
|---|------|------|--------|----------|
| 1 | response.items.length > 0 | assert | ✓ passed | 0.080s |

---
*Generated by Multimeter*
```

#### Function signature

```typescript
function generateReportMarkdown(results: CollectedResults, options?: {
  suiteName?: string;
  includeDetails?: boolean;  // default: true — include <details> for failures
}): string;
```

#### Design decisions

- **GitHub-flavored Markdown** — uses GFM tables and `<details>` blocks, which render natively on GitHub, GitLab, Azure DevOps wikis, and VS Code preview.
- **`<details>` for failures** — keeps the report scannable. Failure details are collapsed by default so the summary table is easy to read.
- **Table per suite** — each test file gets its own table, consistent with the JUnit XML `<testsuite>` and MMT YAML `suites[]` structure.
- **Emoji indicators** — `✓` / `✗` for quick visual scanning in plain text contexts.

### Layer 3: CLI integration

#### New flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `--report <format>` | string | none | Report format: `junit`, `mmt`, `html`, or `md`. |
| `--report-file <path>` | string | auto (see below) | Output path for the report file. |

Default `--report-file` by format:
- `junit` → `test-results.xml`
- `mmt` → `test-results.mmt`
- `html` → `test-results.html`
- `md` → `test-results.md`

#### Behavior

1. When `--report <format>` is passed, the CLI creates a collecting reporter via `createReportCollector()`.
2. The collecting reporter is set as the `reporter` in `RunFileOptions` (replacing the current no-op).
3. After `runner.runFile()` completes, calls the appropriate serializer based on `--report`:
   - `junit` → `generateJunitXml()`
   - `mmt` → `generateMmtReport()`
   - `html` → `generateReportHtml()`
   - `md` → `generateReportMarkdown()`
4. Writes the output string to `--report-file` path.
5. Prints a message: `Report written to <path>`.

#### Example usage

```bash
# JUnit XML (for CI/CD)
npx testlight run test.mmt --report junit
npx testlight run suite.mmt --report junit --report-file results/output.xml

# MMT YAML (human-readable, diffable)
npx testlight run test.mmt --report mmt
npx testlight run suite.mmt --report mmt --report-file results/output.mmt

# HTML (shareable, visual)
npx testlight run suite.mmt --report html
npx testlight run suite.mmt --report html --report-file results/report.html

# Markdown (for PRs, wikis, docs)
npx testlight run suite.mmt --report md
npx testlight run suite.mmt --report md --report-file results/report.md

# In Azure Pipelines
npx testlight run suite.mmt --report junit
# then: PublishTestResults@2 with testResultsFiles: 'test-results.xml'
```

### Layer 4: Webview export buttons

An "Export Report" dropdown button on the test and suite run pages, placed next to the existing Run button in the toolbar area.

#### UI placement

Both `TestTest.tsx` and `SuiteTest.tsx` have a `rightOfRunButton` slot in their toolbar. The export button is added as a new element passed through this slot (or placed directly in the toolbar `div`).

The button is **disabled** when no results exist (i.e. the test/suite hasn't been run yet or is currently running). It becomes **enabled** after a run completes (regardless of pass/fail).

#### Button design

A dropdown button with a `codicon-export` icon:

```
[▶ Run test]  [↗ Export ▾]
                ├─ Export as JUnit XML
                ├─ Export as MMT Report
                ├─ Export as HTML
                └─ Export as Markdown
```

The dropdown uses a simple popover menu (consistent with existing UI patterns). Each option triggers a `postMessage` to the extension host.

#### Data flow (webview → extension → file)

```
Webview                          Extension Host
  │                                    │
  │─ postMessage({                     │
  │    command: 'exportReport',        │
  │    format: 'junit' | 'mmt' | 'html' | 'md',       │
  │    data: { stepReports, runState,  │
  │            outputs, filePath,      │
  │            displayName }           │
  │  }) ──────────────────────────────→│
  │                                    │─ convert webview data → CollectedResults
  │                                    │─ call serializer (junit/mmt/html/md)
  │                                    │─ vscode.window.showSaveDialog()
  │                                    │─ fs.writeFile()
  │                                    │
```

#### Webview data shape

The webview already holds all the data needed in its state:

**Test view** (`TestTest.tsx`):
- `stepReports: StepReportItem[]` — individual check/assert results
- `runState: StepStatus` — overall pass/fail
- `outputs: JSONRecord` — test outputs

**Suite view** (`SuiteTest.tsx`):
- `leafReportsById: Record<string, StepReportItem[]>` — per-leaf step results
- `leafRunStateById: Record<string, StepStatus>` — per-leaf pass/fail
- `stepStatuses: Record<string, StepStatus>` — per-node status
- `suiteRunState: StepStatus` — overall suite pass/fail

The webview sends this data as-is to the extension host. The extension host converts it into `CollectedResults` (the same type used by the CLI collecting reporter) before calling the serializer. This conversion lives in a new helper in `src/mmtAPI/file.ts`.

#### Extension host handler

A new case `'exportReport'` in `messageReceived()` in `src/mmtAPI/mmtAPI.ts`, delegating to `file.handleExportReport()` in `src/mmtAPI/file.ts`. This follows the existing pattern used by `exportHtml` and `exportMarkdown`.

```typescript
// src/mmtAPI/file.ts
type ReportFormat = 'junit' | 'mmt' | 'html' | 'md';

const reportSerializers: Record<ReportFormat, (r: CollectedResults) => string> = {
  junit: generateJunitXml,
  mmt: generateMmtReport,
  html: generateReportHtml,
  md: generateReportMarkdown,
};

const reportDefaults: Record<ReportFormat, { name: string; filters: Record<string, string[]> }> = {
  junit: { name: 'test-results.xml', filters: { 'JUnit XML': ['xml'] } },
  mmt: { name: 'test-results.mmt', filters: { 'MMT Report': ['mmt'] } },
  html: { name: 'test-results.html', filters: { 'HTML': ['html'] } },
  md: { name: 'test-results.md', filters: { 'Markdown': ['md', 'markdown'] } },
};

async function handleExportReport(
  message: { format: ReportFormat; data: WebviewReportData },
  document: vscode.TextDocument
): Promise<void> {
  const results = webviewDataToCollectedResults(message.data);
  const content = reportSerializers[message.format](results);
  const { name, filters } = reportDefaults[message.format];
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), name)),
    filters,
  });
  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(`Report exported to ${path.basename(uri.fsPath)}`);
  }
}
```

### Layer 5: Report viewer (`type: report`)

Opening an `.mmt` file with `type: report` renders the results visually in a **read-only** panel inside the multimeter custom editor. No YAML editor toggle — the panel is view-only.

#### Routing

The existing `App.tsx` in `mmtview/` routes by the YAML `type` field. A new branch handles `type: report`:

```tsx
case 'report':
  return <ReportPanel data={parsedData} filePath={filePath} />;
```

The `mmtEditorProvider` already handles all `.mmt` files. `JSer.fileType` in `core/` needs to recognize `'report'` as a valid type (alongside `'api'`, `'test'`, `'suite'`, `'env'`, `'var'`, `'mock'`, `'doc'`).

#### Panel design

The `ReportPanel` is a read-only view that reuses the existing `TestStepReportPanel` component for visual consistency with the test/suite run results:

```
┌──────────────────────────────────────────────────┐
│  Test Report: suite-title               [↗ Export ▾]  │
│  ✓ 10 passed  ✗ 2 failed  12 total  3.456s      │
├──────────────────────────────────────────────────┤
│  ▼ test-file.mmt                        ✗ failed │
│    ✓ status == 200                       0.100s  │
│    ✗ result.name == John                 0.050s  │
│      Expected: John                              │
│      Actual:   Jane                              │
│                                                  │
│  ▼ another-test.mmt                     ✓ passed │
│    ✓ response.items.length > 0           0.080s  │
└──────────────────────────────────────────────────┘
```

#### Data flow

1. Extension host reads the `.mmt` file content and sends it to the webview.
2. Webview parses the YAML (using the existing YAML parser in `mmtview`).
3. `ReportPanel` maps the `type: report` YAML structure into `StepReportItem[]` arrays (the same shape used by `TestStepReportPanel`).
4. Each `suites[n]` entry renders as a collapsible section with its `tests` displayed via `TestStepReportPanel`.

#### YAML → StepReportItem mapping

A new pure helper `core/src/reportParser.ts` converts the `type: report` YAML structure into `CollectedResults`:

```typescript
function parseReportMmt(yamlContent: Record<string, any>): CollectedResults;
```

The webview then maps `CollectedResults` → `StepReportItem[]` per suite for rendering. This mapping is done in the webview since `StepReportItem` is a webview type.

#### Export from viewer

The report viewer includes the same `ExportReportButton` dropdown used in the test/suite run pages. It allows re-exporting the viewed report to any format (JUnit XML, MMT Report, HTML, Markdown). The data flow is:

1. Webview has the parsed `CollectedResults` from the report file.
2. User clicks Export → format selection.
3. Webview sends `postMessage({ command: 'exportReport', format, data })` — same command as test/suite export.
4. Extension host serializes and shows save dialog — same handler.

This means a user can open an `.mmt` report, view it visually, then re-export as HTML to share with stakeholders or as JUnit XML for CI/CD.

### Layer 6: Documentation

User-facing documentation in `docs/` covering:

- **CLI report flags** — `--report junit`, `--report mmt`, `--report html`, `--report md`, `--report-file` with examples
- **Report formats** — JUnit XML, MMT YAML, HTML, and Markdown format descriptions with sample output
- **CI/CD integration** — copy-paste snippets for Azure Pipelines, GitHub Actions, GitLab CI, Jenkins
- **VS Code export** — how to use the Export Report button in the test, suite, and report views
- **Report viewer** — how to open `.mmt` report files and view results visually

This can be either a new `docs/reports.md` or a new section in the existing `docs/testlight.md` (for CLI) and `docs/test-mmt.md` / `docs/suite-mmt.md` (for VS Code export).

### Edge cases

| Scenario | Behavior |
|---|---|
| API run (`type: api`) | Not supported initially. API runs don't have check/assert steps by default. Returns an empty `<testsuites>` or skips report generation with a warning. |
| Test with no checks | Single `<testsuite>` with zero `<testcase>` elements. `tests="0"`. |
| Suite with mixed test + API children | API children that have no steps produce empty `<testsuite>` elements. |
| Test throws before any checks | One `<testsuite>` with one `<testcase>` containing `<error>` (runtime exception). |
| Cancelled run | `<testsuites>` includes completed items; remaining items are not listed. A property `<property name="cancelled" value="true"/>` is added to the root. |
| Special characters in names | Escaped via `escapeXml()` in all attribute values and text content. |
| Export before run | Button is disabled. No report data to export. |
| Export during run | Button is disabled. Partial results are not exported. |
| Export after failed run | Button is enabled. Failed results are fully exported. |
| Open malformed report file | Show error message in the panel if YAML parsing fails or `type` is not `report`. |
| Report file with empty suites | Render empty panel with summary showing 0 tests. |

## Future extensions

These are out of scope for the initial implementation but inform the design:

- **`--report` for API runs**: If API runs gain inline checks (per `sdd-call-inline-check.md`), they produce test steps and become reportable.
- **Skip support**: If a `skip` step type or conditional skip is added, extend `TestStepResult` with `status: 'skipped'` and emit `<skipped/>` / `result: skipped` elements.
- **Multiple reporters**: Allow `--report junit,html` to generate multiple formats in one run.
- **Report diffing**: The MMT YAML format is line-oriented and human-readable, making it ideal for `git diff` comparisons between runs in PRs.
- **Auto-export setting**: A workspace/user setting to automatically export reports after every run without clicking the button.
- **Report history**: Store past report files and show trend comparisons within the VS Code extension.

## Changes

### 1. `core/src/reportCollector.ts` (new)

- `createReportCollector()` function → returns `{ reporter, getResults }`.
- Types: `TestStepResult`, `TestRunResult`, `SuiteRunResult`, `CollectedResults`.
- Routes `RunReporterMessage` events into the structured result tree.

### 2. `core/src/junitXml.ts` (new)

- `generateJunitXml(results, options?)` → XML string.
- `escapeXml(str)` helper.
- Pure function, no side effects.

### 3. `core/src/mmtReport.ts` (new)

- `generateMmtReport(results, options?)` → YAML string.
- Uses the `yaml` library (already a core dependency) for serialization.
- Pure function, no side effects.

### 4. `core/src/reportHtml.ts` (new)

- `generateReportHtml(results, options?)` → self-contained HTML string.
- Inline CSS with dark/light theme via `prefers-color-scheme`.
- Reuses `escapeHtml()` helper from `docHtml.ts` and the CSS variable scheme.
- Pure function, no side effects.

### 5. `core/src/reportMarkdown.ts` (new)

- `generateReportMarkdown(results, options?)` → GFM Markdown string.
- Tables per suite, `<details>` blocks for failure details.
- Pure function, no side effects.

### 6. `core/src/junitXml.test.ts` (new)

- Test: standalone test with all passes → valid XML with zero failures.
- Test: standalone test with failures → `<failure>` elements with actual/expected.
- Test: suite with multiple test files → nested `<testsuite>` elements.
- Test: empty test (no steps) → valid XML with `tests="0"`.
- Test: test that throws → `<error>` element.
- Test: special characters in names → properly escaped.
- Test: cancelled run → `cancelled` property present.

### 7. `core/src/mmtReport.test.ts` (new)

- Test: standalone test → YAML with `type: report` and single suite entry.
- Test: suite with multiple tests → multiple entries in `suites`.
- Test: failed steps → `failure` objects with actual/expected.
- Test: empty test → `tests: []` in suite entry.
- Test: cancelled run → root-level `cancelled: true`.
- Test: output is valid YAML (round-trip parse).
- Test: duration formatted as `Xs` string.

### 8. `core/src/reportHtml.test.ts` (new)

- Test: standalone test → valid HTML with summary counts.
- Test: suite → multiple suite sections.
- Test: failed steps → failure detail blocks with actual/expected.
- Test: special characters → properly escaped in HTML.
- Test: output contains inline `<style>` (self-contained).
- Test: output contains no external resource references.

### 9. `core/src/reportMarkdown.test.ts` (new)

- Test: standalone test → Markdown with summary header and table.
- Test: suite → one table per suite.
- Test: failed steps → `<details>` blocks with actual/expected.
- Test: empty test → table with no rows.
- Test: special characters → properly escaped in Markdown table cells.

### 10. `core/src/reportCollector.test.ts` (new)

- Test: collecting reporter accumulates test-step events correctly.
- Test: events are matched by `id` then `runId`.
- Test: suite lifecycle events populate `SuiteRunResult`.
- Test: standalone test run (no suite events) creates a single `TestRunResult`.

### 11. `mmtcli/src/cli.ts`

- Import `createReportCollector`, `generateJunitXml`, `generateMmtReport`, `generateReportHtml`, and `generateReportMarkdown` from `core`.
- Add `--report` and `--report-file` options to the `run` command.
- Wire collecting reporter when `--report` is set.
- After run, call the appropriate serializer and write the report file.

### 12. `mmtcli/src/runArgs.ts`

- When `--report` is provided, replace the no-op reporter with the collecting reporter's `reporter` function.

### 13. `core/src/index.ts` (or core exports)

- Export `createReportCollector`, `generateJunitXml`, `generateMmtReport`, `generateReportHtml`, `generateReportMarkdown`, `parseReportMmt`, and the result types.

### 14. `core/src/reportParser.ts` (new)

- `parseReportMmt(yamlContent)` → `CollectedResults`.
- Validates `type: report` and maps `suites[].tests[]` into the `CollectedResults` structure.
- Pure function, no side effects.

### 15. `core/src/reportParser.test.ts` (new)

- Test: valid report YAML → correct `CollectedResults`.
- Test: report with failures → `TestStepResult` entries with `status: 'failed'` and failure data.
- Test: empty report (no suites) → empty `CollectedResults`.
- Test: missing or wrong `type` field → throws or returns error.

### 16. `core/src/JSer.ts` (or file type detection)

- Add `'report'` to the recognized `fileType` values so `JSer.fileType` returns `'report'` for `type: report` files.

### 17. `mmtview/src/report/ReportPanel.tsx` (new)

- Read-only panel component for `type: report` files.
- Parses the YAML content into `CollectedResults` via `parseReportMmt()`.
- Renders a summary header (pass/fail counts, duration) and collapsible suite sections.
- Each suite section renders its tests via the existing `TestStepReportPanel` component.
- Includes `ExportReportButton` in the toolbar for re-exporting to other formats.

### 18. `mmtview/src/App.tsx`

- Add `case 'report'` to the type-based routing, rendering `<ReportPanel />`.

### 19. `mmtview/src/shared/ExportReportButton.tsx` (new)

- Dropdown button component with four options: JUnit XML, MMT Report, HTML, Markdown.
- Accepts `disabled` prop (true when no results or run in progress).
- Accepts `onExport(format: 'junit' | 'mmt' | 'html' | 'md')` callback.
- Uses `codicon-export` icon.

### 20. `mmtview/src/test/TestTest.tsx`

- Import and render `ExportReportButton` in the toolbar, next to the Run button.
- Wire `onExport` to send `postMessage({ command: 'exportReport', format, data: { stepReports, runState, outputs } })`.
- Disable button when `runState` is `'default'` or `'running'`.

### 21. `mmtview/src/suite/test/SuiteTest.tsx`

- Import and render `ExportReportButton` in the toolbar, next to the Run suite button.
- Wire `onExport` to send `postMessage({ command: 'exportReport', format, data: { leafReportsById, leafRunStateById, stepStatuses, suiteRunState } })`.
- Disable button when `suiteRunState` is `'default'` or `'running'`.

### 22. `src/mmtAPI/mmtAPI.ts`

- Add `'exportReport'` case in `messageReceived()` switch, delegating to `file.handleExportReport()`.

### 23. `src/mmtAPI/file.ts`

- Add `handleExportReport()` — converts webview data to `CollectedResults`, calls the appropriate serializer (junit/mmt/html/md), shows save dialog, writes file.
- Add `webviewDataToCollectedResults()` helper to map webview state shapes to the core `CollectedResults` type.
- Use a `reportSerializers` map for clean format → serializer dispatch.

### 24. `docs/testlight.md`

- Document `--report junit`, `--report mmt`, `--report html`, `--report md`, and `--report-file` flags.
- Add CI/CD integration examples (Azure Pipelines, GitHub Actions, GitLab CI).

### 25. `docs/test-mmt.md`

- Add "Exporting Results" section documenting the Export Report button and supported formats.

### 26. `docs/suite-mmt.md`

- Add "Exporting Results" section documenting the Export Report button for suite runs.

### 27. `docs/reports.md` (new)

- Dedicated report format reference:
  - JUnit XML format description with full sample output.
  - MMT YAML format description with full sample output.
  - HTML report description with screenshot/sample.
  - Markdown report description with sample output.
  - Report viewer: opening `.mmt` report files in VS Code.
  - CI/CD integration recipes (Azure Pipelines, GitHub Actions, GitLab CI, Jenkins).
  - Local viewing options.

## Implementation order

1. `core/src/reportCollector.ts` + tests
2. `core/src/junitXml.ts` + tests
3. `core/src/mmtReport.ts` + tests
4. `core/src/reportHtml.ts` + tests
5. `core/src/reportMarkdown.ts` + tests
6. `core/src/reportParser.ts` + tests
7. `mmtcli/` CLI wiring (`cli.ts` + `runArgs.ts`)
8. `mmtview/` export button component + wiring in `TestTest.tsx` and `SuiteTest.tsx`
9. `mmtview/` report viewer (`ReportPanel.tsx` + `App.tsx` routing + `JSer.ts` type recognition)
10. `src/mmtAPI/` extension host handler (`mmtAPI.ts` + `file.ts`)
11. Documentation (`docs/reports.md`, `docs/testlight.md`, `docs/test-mmt.md`, `docs/suite-mmt.md`)
