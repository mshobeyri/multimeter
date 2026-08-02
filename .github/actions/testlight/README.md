# Testlight GitHub Action

Run Multimeter (`.mmt`) API tests, test suites, and generate documentation in your GitHub Actions workflow.

## Usage

```yaml
- name: Run API tests
  uses: mshobeyri/multimeter/.github/actions/testlight@main
  with:
    file: tests/login.mmt
    env-file: tests/env.mmt
    preset: ci
    report: junit
    report-file: test-results/report.xml
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `file` | **Yes** | — | Path to the `.mmt` file |
| `command` | No | `run` | `run`, `doc`, or `print-js` |
| `env-file` | No | — | Path to environment file |
| `preset` | No | — | Preset name from env file |
| `env` | No | — | Environment variables (`KEY=VALUE` pairs) |
| `input` | No | — | Input variables (`KEY=VALUE` pairs) |
| `example` | No | — | Specific example name or index |
| `report` | No | — | Report format: `junit`, `html`, `md`, `mmt` |
| `report-file` | No | — | Custom report output path |
| `out` | No | — | Write result JSON to file |
| `quiet` | No | `false` | Minimal output |
| `log-level` | No | — | `error`, `warn`, `info`, `debug`, `trace` |
| `version` | No | `latest` | testlight version to install |
| `working-directory` | No | `.` | Working directory |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Path to result JSON (when `out` is set) |
| `report` | Path to report file (when `report-file` is set) |
| `exit-code` | Exit code of testlight |

## Examples

### Basic test run

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        uses: mshobeyri/multimeter/.github/actions/testlight@main
        with:
          file: tests/suite.mmt
```

### With JUnit report upload

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        uses: mshobeyri/multimeter/.github/actions/testlight@main
        with:
          file: tests/suite.mmt
          env-file: tests/env.mmt
          preset: ci
          report: junit
          report-file: results/junit.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: results/junit.xml
```

### Generate API documentation

```yaml
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate docs
        uses: mshobeyri/multimeter/.github/actions/testlight@main
        with:
          command: doc
          file: api/catalog.mmt
          out: public/api-docs.html
```
