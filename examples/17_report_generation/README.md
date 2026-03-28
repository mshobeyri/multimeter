# Report Generation

Demonstrates how to generate **test reports** in JUnit XML, HTML, Markdown, and MMT YAML formats — both via CLI flags and via the suite `export` field.

## Structure

```
17_report_generation/
├── api/
│   └── echo.mmt                 # Simple echo API
├── test/
│   ├── pass_test.mmt            # A test that passes
│   └── fail_test.mmt            # A test with a deliberate failure (for demo)
├── suite.mmt                    # Suite with export field for auto-report
├── reports/                     # Generated reports appear here
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/echo.mmt` | Echo API used by both tests |
| `test/pass_test.mmt` | Calls the echo API and asserts status 200 — should pass |
| `test/fail_test.mmt` | Calls the echo API and checks for status 999 — deliberately fails |
| `suite.mmt` | Suite with `export` field that auto-generates JUnit XML and HTML reports |

## Report formats

| Format | Flag | Default file | Description |
|--------|------|--------------|-------------|
| JUnit XML | `--report junit` | `test-results.xml` | CI/CD standard (GitHub Actions, Jenkins, etc.) |
| HTML | `--report html` | `test-results.html` | Self-contained page with pass/fail indicators |
| Markdown | `--report md` | `test-results.md` | GitHub-flavored tables, great for PRs |
| MMT YAML | `--report mmt` | `test-results.mmt` | Native format, can be viewed in Multimeter |

## Key concepts

- **`--report FORMAT`** — CLI flag to generate a report after a test/suite run.
- **`--report-file PATH`** — custom output path for the report.
- **Suite `export`** — list of file paths in the suite file. Reports are auto-generated after the suite completes, with the format inferred from the file extension.
- **`report` on checks** — controls reporting level: `all` (pass + fail), `fails` (only failures), `none` (silent).

## How to use

### In VS Code

1. Open `suite.mmt` and click **Run**.
2. After the run completes, click the **Export** button in the toolbar.
3. Choose a format (JUnit XML, HTML, Markdown, or MMT YAML).

### With the CLI

Run the suite with automatic export (uses the `export` field):

```sh
npx testlight run examples/17_report_generation/suite.mmt
```

Generate a specific report format:

```sh
# JUnit XML
npx testlight run examples/17_report_generation/suite.mmt --report junit

# HTML
npx testlight run examples/17_report_generation/suite.mmt --report html

# Markdown
npx testlight run examples/17_report_generation/suite.mmt --report md

# MMT YAML
npx testlight run examples/17_report_generation/suite.mmt --report mmt
```

Custom output path:

```sh
npx testlight run examples/17_report_generation/suite.mmt \
  --report junit --report-file ./my-reports/output.xml
```

Run a single test with a report:

```sh
npx testlight run examples/17_report_generation/test/pass_test.mmt --report junit
```
