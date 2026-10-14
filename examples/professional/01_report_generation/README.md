# Report Generation

Demonstrates how to generate **test reports** in JUnit XML, HTML, Markdown, and MMT YAML formats — both via CLI flags and via the suite `export` field. Includes a **skipped** test (via suite tag filter) so reports show skipped results.

## Structure

```
01_report_generation/
├── multimeter.mmt               # Project root marker (enables +/ paths in reports)
├── api/
│   └── echo.mmt                 # Simple echo API
├── test/
│   ├── pass_test.mmt            # A test that passes
│   ├── fail_test.mmt            # A test with a deliberate failure (for demo)
│   └── skip_test.mmt            # Tagged skip-demo; suite filter skips it
├── suite.mmt                    # Suite with export field for auto-report
├── reports/                     # Generated reports appear here
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/echo.mmt` | Echo API used by the tests |
| `test/pass_test.mmt` | Calls the echo API and asserts status 200 — should pass |
| `test/fail_test.mmt` | Calls the echo API and checks for status 999 — deliberately fails |
| `test/skip_test.mmt` | Tagged `skip-demo`; suite `filter.skip` marks it skipped in reports |
| `suite.mmt` | Suite with `export` that auto-generates JUnit XML, HTML, and MMT reports |

## Report formats

| Format | Flag | Default file | Description |
|--------|------|--------------|-------------|
| JUnit XML | `--report junit` | `test-results.xml` | CI/CD standard (GitHub Actions, Jenkins, etc.) |
| HTML | `--report html` | `test-results.html` | Self-contained page with pass/fail/skipped indicators |
| Markdown | `--report md` | `test-results.md` | GitHub-flavored tables, great for PRs |
| MMT YAML | `--report mmt` | `test-results.mmt` | Native format, can be viewed in Multimeter |

## Key concepts

- **`--report FORMAT`** — CLI flag to generate a report after a test/suite run.
- **`--report-file PATH`** — custom output path for the report.
- **Suite `export`** — list of file paths in the suite file. Reports are auto-generated after the suite completes, with the format inferred from the file extension (`.xml`, `.html`, `.md`, `.mmt`).
- **`filter.skip`** — tag filter that skips matching tests; skipped items appear in reports with `result: skipped`.
- **`report` on checks** — controls reporting level: `all` (pass + fail), `fails` (only failures), `none` (silent).
- **`+/` file paths** — exported reports store source files as `+/…` relative to `multimeter.mmt` (portable; Ctrl+click in MMT reports opens from that root).

## How to use

### In VS Code

1. Open `suite.mmt` and click **Run**.
2. After the run completes, click the **Export** button in the toolbar.
3. Choose a format (JUnit XML, HTML, Markdown, or MMT YAML).
4. Or open `reports/results.mmt` in Multimeter to view the native report.

### With the CLI

Run the suite with automatic export (uses the `export` field — writes XML, HTML, and MMT):

```sh
npx testlight run examples/professional/01_report_generation/suite.mmt
```

Generate a specific report format:

```sh
# JUnit XML
npx testlight run examples/professional/01_report_generation/suite.mmt --report junit

# HTML
npx testlight run examples/professional/01_report_generation/suite.mmt --report html

# Markdown
npx testlight run examples/professional/01_report_generation/suite.mmt --report md

# MMT YAML
npx testlight run examples/professional/01_report_generation/suite.mmt --report mmt
```

Custom output path:

```sh
npx testlight run examples/professional/01_report_generation/suite.mmt \
  --report junit --report-file ./my-reports/output.xml
```

Run a single test with a report:

```sh
npx testlight run examples/professional/01_report_generation/test/pass_test.mmt --report junit
```
