# Testlight Action

Run Multimeter (`.mmt`) API tests, test suites, and generate documentation in GitHub Actions.

This is the Marketplace listing for Testlight. Source in the [Multimeter](https://github.com/mshobeyri/multimeter) repo is `mmtaction/` (published to this repo on release).

## Usage

```yaml
- uses: actions/checkout@v6
- uses: mshobeyri/testlight-action@v1
  with:
    file: tests/suite.mmt
    env-file: tests/env.mmt
    preset: ci
    report: junit
    report-file: results/junit.xml
```

The `version` input defaults to `latest`. Pass `pre` or `X.Y.Z` to pin `mmt-testlight`.

Docs: [Install Testlight](https://mmt.dev/docs/features/testlight/install) · [Run in CI](https://mmt.dev/docs/tasks/run-in-ci)

## Sample pipelines

Copy-paste pipelines live under [`examples/`](examples/). They run the `.mmt` files in that folder against `https://test.mmt.dev` (no secrets).

| File | What it is |
|---|---|
| [`examples/github-actions.yml`](examples/github-actions.yml) | Consumer GitHub workflow (`uses: mshobeyri/testlight-action@v1`) |
| [`examples/azure-pipelines.yml`](examples/azure-pipelines.yml) | Same job as Azure task `Testlight@1` with YAML `inputs:` |
| [`examples/suite.mmt`](examples/suite.mmt) | Two-test suite those pipelines run |
| [`examples/echo_test.mmt`](examples/echo_test.mmt) | Single POST echo test |
| [`examples/get_json.mmt`](examples/get_json.mmt) | GET JSON API |

The **Samples** workflow in this repo is the self-test (`uses: ./`). GitHub does not run `azure-pipelines.yml`; point Azure DevOps at this repo (or copy that file) to run the Azure version.

### GitHub vs Azure

| Step | GitHub Actions | Azure Pipelines |
|---|---|---|
| Fetch this repo’s `.mmt` files | `actions/checkout@v6` | `checkout: self` (pipeline step, not the task) |
| Run Testlight | `uses: mshobeyri/testlight-action@v1` + `with:` | `- task: Testlight@1` + `inputs:` |
| Publish results | `actions/upload-artifact` | `PublishTestResults@2` (Tests tab) |

Azure already clones the triggering repo. The Testlight task only takes YAML parameters and runs the `.mmt` file — it does not fetch git or start your app.

GitHub:

```yaml
- uses: actions/checkout@v6
- uses: mshobeyri/testlight-action@v1
  with:
    file: examples/suite.mmt
    report: junit
    report-file: results/junit.xml
```

Azure:

```yaml
steps:
  - checkout: self
  - task: Testlight@1
    inputs:
      file: examples/suite.mmt
      report: junit
      reportFile: results/junit.xml
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: results/junit.xml
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
| `report-file` | No | — | Custom report output path. Parent directories are created. |
| `out` | No | — | Write result JSON to file. Parent directories are created. |
| `quiet` | No | `false` | Minimal output |
| `log-level` | No | — | `error`, `warn`, `info`, `debug`, `trace` |
| `version` | No | `latest` | `mmt-testlight` version to install (`latest`, `pre`, or `X.Y.Z`) |
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
      - uses: actions/checkout@v6
      - name: Run tests
        uses: mshobeyri/testlight-action@v1
        with:
          file: tests/suite.mmt
```

### With JUnit report upload

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Run tests
        uses: mshobeyri/testlight-action@v1
        with:
          file: tests/suite.mmt
          env-file: tests/env.mmt
          preset: ci
          report: junit
          report-file: results/junit.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v5
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
      - uses: actions/checkout@v6

      - name: Generate docs
        uses: mshobeyri/testlight-action@v1
        with:
          command: doc
          file: api/catalog.mmt
          out: public/api-docs.html
```

## License

Apache License 2.0. See [LICENSE.md](./LICENSE.md).
