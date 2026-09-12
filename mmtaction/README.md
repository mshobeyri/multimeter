# Testlight Action

Run Multimeter (`.mmt`) API tests, test suites, and generate documentation in GitHub Actions.

Source in [Multimeter](https://github.com/mshobeyri/multimeter) is `mmtaction/`. This repo is the published Action.

## Usage

```yaml
- uses: actions/checkout@v6
- uses: mshobeyri/testlight-action@v1
  with:
    file: tests/suite.mmt
    report: junit
    report-file: results/junit.xml
```

The `version` input defaults to `latest`. Pass `pre` or `X.Y.Z` to pin `mmt-testlight`.

Docs: [Install Testlight](https://mmt.dev/docs/features/testlight/install) · [Run in CI](https://mmt.dev/docs/tasks/run-in-ci)

## Samples

Same shape as a real repo: a workflow plus `tests/`.

| File | What it is |
|---|---|
| [`examples/ci.yml`](examples/ci.yml) | Workflow (copy to `.github/workflows/ci.yml`) |
| [`examples/tests/suite.mmt`](examples/tests/suite.mmt) | Runs `get.mmt` then `post.mmt` |
| [`examples/tests/get.mmt`](examples/tests/get.mmt) | GET `https://test.mmt.dev/json` |
| [`examples/tests/post.mmt`](examples/tests/post.mmt) | POST echo |

This Action repo runs `examples/ci.yml` as `.github/workflows/ci.yml` with `uses: ./`. In your repo, copy `examples/tests/` to `tests/` and use `mshobeyri/testlight-action@v1` as in Usage.

Azure Pipelines is a separate product (`mmtazure/`, `- task: Testlight@1`). See [Run in CI](https://mmt.dev/docs/tasks/run-in-ci).

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
