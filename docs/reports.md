# Test Reports

Multimeter can generate structured test reports after running `.mmt` test and suite files. Reports are available in four formats and can be generated from both the CLI (`testlight`) and the VS Code extension.

## Formats

### JUnit XML

The universal CI/CD standard. Every major CI/CD tool (Azure Pipelines, GitHub Actions, GitLab CI, Jenkins) natively supports JUnit XML for test result visualization.

**Default filename:** `test-results.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="suite.mmt" tests="4" failures="1" errors="0" skipped="0" time="1.234">
  <testsuite name="test-file.mmt" tests="2" failures="1" errors="0" skipped="0" time="0.500" file="test-file.mmt">
    <testcase name="status == 200" classname="test-file.mmt" time="0.100"/>
    <testcase name="result.name == John" classname="test-file.mmt" time="0.050">
      <failure message="expected: John, actual: Jane, operator: ==" type="check">expected: John
actual: Jane
operator: ==</failure>
    </testcase>
  </testsuite>
</testsuites>
```

### MMT Report (YAML)

A multimeter-native YAML format with `type: report`. Human-readable, easy to diff in pull requests, and consistent with the `.mmt` ecosystem. Can be opened in multimeter for visual review.

**Default filename:** `test-results.mmt`

```yaml
type: report
name: suite.mmt
timestamp: "2026-03-06T10:30:00.000Z"
duration: 1.234s
summary:
  tests: 4
  passed: 3
  failed: 1
  errors: 0
  skipped: 0
suites:
  - name: test-file.mmt
    file: test-file.mmt
    duration: 0.500s
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
```

### HTML

A self-contained HTML page with inline CSS, dark/light theme support (via `prefers-color-scheme`), and visual pass/fail indicators. No external dependencies — the file can be emailed, attached to a ticket, or served from any static host.

**Default filename:** `test-results.html`

### Markdown

A lightweight GitHub-flavored Markdown report with tables per test suite and collapsible failure details. Ideal for pasting into PRs, issues, wikis, or README files.

**Default filename:** `test-results.md`

## CLI Usage

Use the `--report` flag with the `testlight run` command:

```bash
# Generate JUnit XML report
npx testlight run test.mmt --report junit

# Generate MMT YAML report
npx testlight run suite.mmt --report mmt

# Generate HTML report
npx testlight run suite.mmt --report html

# Generate Markdown report
npx testlight run test.mmt --report md
```

### Custom output path

Use `--report-file` to specify a custom output path:

```bash
npx testlight run suite.mmt --report junit --report-file results/output.xml
npx testlight run suite.mmt --report html --report-file reports/results.html
```

### Default output paths

| Format | Default filename |
|--------|-----------------|
| `junit` | `test-results.xml` |
| `mmt` | `test-results.mmt` |
| `html` | `test-results.html` |
| `md` | `test-results.md` |

### Suite auto-export

Suites can automatically generate reports after completion using the `export` field:

```yaml
type: suite
title: CI Suite
tests:
  - tests/login.mmt
  - tests/profile.mmt
export:
  - ./reports/results.xml     # JUnit XML
  - ./reports/results.html    # HTML report
```

This is equivalent to running with `--report` but configured directly in the suite file. Useful for consistent CI outputs without additional CLI flags. See [Suite — Exports](./suite-mmt.md#exports) for details.

## VS Code Extension

### Export Report button

After running a test or suite in the VS Code extension, an **Export** button appears in the toolbar (next to Run and Edit). Click it to choose a format:

- **JUnit XML** — for CI/CD integration
- **MMT Report** — for the `.mmt` ecosystem
- **HTML** — for sharing with stakeholders
- **Markdown** — for PRs and documentation

A save dialog will prompt you for the output location.

The Export button is disabled until a run completes (either pass or fail).

### Report Viewer

Opening an `.mmt` file with `type: report` in VS Code renders a read-only visual panel showing:

- Summary header with pass/fail counts and duration
- Collapsible test suite sections
- Individual test step results with pass/fail indicators
- Failure details (expected, actual, operator)

The viewer includes an Export button to re-export the report to any format.

## CI/CD Integration

### Azure Pipelines

```yaml
steps:
  - script: npx testlight run suite.mmt --report junit
    displayName: Run Multimeter Tests

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: test-results.xml
    condition: always()
```

### GitHub Actions

```yaml
steps:
  - name: Run tests
    run: npx testlight run suite.mmt --report junit

  - name: Publish test results
    uses: dorny/test-reporter@v1
    if: always()
    with:
      name: Multimeter Tests
      path: test-results.xml
      reporter: java-junit
```

### GitLab CI

```yaml
test:
  script:
    - npx testlight run suite.mmt --report junit --report-file report.xml
  artifacts:
    reports:
      junit: report.xml
```

### Jenkins

```groovy
pipeline {
    stages {
        stage('Test') {
            steps {
                sh 'npx testlight run suite.mmt --report junit'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }
    }
}
```

---

## See also
- [Testlight CLI](./testlight.md) — `--report` and `--report-file` flags
- [Test](./test-mmt.md) — test files that produce reports
- [Suite](./suite-mmt.md) — suite files that produce reports
- [Logging](./logging.md) — log levels during test runs
- [Sample Project](./sample-project.md) — full walkthrough with CI examples
