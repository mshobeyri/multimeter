# Load Test

Use `type: loadtest` to define a load test MMT file. A load test runs one `type: test` file repeatedly with concurrency, ramp-up, duration or iteration limits, and load-oriented reporting.

> **Beta:** Load testing is currently supported in beta mode. The file shape and report schema are stable enough for local and CI use, but advanced distributed load execution and deeper threshold controls may still evolve.

Example:

```yaml
type: loadtest
title: Login Load Test
description: Run the login flow with 100 virtual users for one minute.
tags:
  - load
  - auth
environment:
  preset: perf
threads: 100
repeat: 1m
rampup: 10s
export:
  - ./reports/login-load.mmt
  - ./reports/login-load.html
test: ./tests/login.mmt
```

## Elements

### title, description, tags
You can use these fields for documentation and for finding load test files in a project.

- `title`: The title shown in the UI and reports.
- `description`: A short explanation of what the load test measures.
- `tags`: An array of strings such as `load`, `perf`, `smoke`, or `api`.

### test
The `test` property is a required path to a single `type: test` file. The referenced test is the scenario that each virtual user/iteration runs.

Paths can be:
- **Relative** to the load test file's location (e.g., `./tests/login.mmt`)
- **Project root** paths using `+/` prefix (e.g., `+/tests/login.mmt`) — resolves relative to the directory containing `multimeter.mmt`

```yaml
test: ./tests/login.mmt
```

The referenced file should stay a normal functional `type: test`. Do not put load-specific fields inside the test file; keep the load settings in the `type: loadtest` wrapper.

### threads
`threads` controls target concurrency. It is optional and defaults to `1`.

```yaml
threads: 25
```

### repeat
`repeat` is required and controls when the load test stops.

```yaml
repeat: 10s     # duration
repeat: 1m      # duration
repeat: 1000    # total iterations across all threads
```

Repeat semantics:

- Numeric value (`repeat: 1000`): run exactly 1000 total test iterations across all threads, then finish.
- Duration string (`repeat: 1m`, `repeat: 10s`): keep starting iterations until the duration expires.

If `threads` is greater than 1, numeric repeat is still a **total** iteration count, not a per-thread count.

### rampup
`rampup` is optional and defaults to `0s`. It controls how long Multimeter takes to reach the target thread count.

```yaml
rampup: 30s
```

For example, with `threads: 100` and `rampup: 10s`, Multimeter gradually starts workers over 10 seconds instead of starting all 100 at once.

### environment
Use the `environment` field to configure environment variables for load test runs. It uses the same shape as suite environment configuration.

```yaml
type: loadtest
title: Load test with environment
environment:
  preset: staging
  file: ./envs/custom.mmt
  variables:
    API_URL: https://staging.example.com
threads: 20
repeat: 30s
test: ./tests/login.mmt
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name to select from `multimeter.mmt` (or from `file` if specified) |
| `file` | `string` | Path to an env file to load (relative to the loadtest file or `+/` for project root) |
| `variables` | `Record<string, any>` | Inline key-value environment variables |

#### Priority Order

Environment variables are resolved with different priority depending on the entry point:

**CLI (`testlight`):**
1. CLI `-e` flags (highest)
2. Load test `environment.variables`
3. Load test `environment.preset`
4. CLI `--env-file` + `--preset`
5. Project defaults (lowest)

**VS Code UI:**
1. Load test `environment.variables` (highest)
2. Load test `environment.preset`
3. VS Code local storage variables
4. Environment panel settings
5. Project defaults (lowest)

### export
Use the `export` field to automatically generate reports after load test completion.

```yaml
type: loadtest
title: CI Load Test
threads: 50
repeat: 1m
rampup: 10s
export:
  - ./reports/load-results.mmt
  - ./reports/load-results.html
  - ./reports/load-results.md
  - ./reports/load-results.xml
test: ./tests/login.mmt
```

#### Supported Export Formats

| Extension | Format | Description |
|-----------|--------|-------------|
| `.mmt` | MMT | Structured load result data in YAML |
| `.html` | HTML | Human-readable report with load metrics, SVG charts, and snapshots |
| `.md` | Markdown | Plain text load summary with Mermaid charts and snapshot table |
| `.xml` | JUnit XML | CI-compatible XML with load metrics as properties |

Exports are generated after the load test finishes. Paths can be relative to the load test file or use `+/` for project root paths. Parent directories are created automatically if they don't exist.

## UI and Execution

When you open a load test file, the Multimeter panel shows:

- The referenced test scenario
- Load configuration (`threads`, `repeat`, `rampup`)
- Environment and export settings
- Live overview metrics while the run is active

During a run, Multimeter displays current requests, failures, success rate, duration, and thread count. After completion, you can export the result to MMT, HTML, Markdown, or JUnit XML.

## Running load tests from the CLI

Use `testlight` to run a load test from the command line or CI:

```sh
testlight run path/to/loadtest.mmt --env-file env.mmt --preset perf
```

You can also generate a report explicitly:

```sh
testlight run path/to/loadtest.mmt --report html --report-file reports/load.html
```

If the load test file has an `export` field, those reports are generated automatically after the run.

## Reports

Load tests produce compact load-oriented reports. They do **not** keep every individual test iteration in the report.

- MMT (`.mmt`) reports use `type: report`, `kind: load`, root-level load fields, and `snapshots`.
- HTML reports include overview cards, load metrics, SVG time-series charts, snapshots, thresholds, and errors when available.
- Markdown reports include overview, metric tables, Mermaid `xychart` blocks, and snapshot tables.
- JUnit XML reports keep normal `<testsuites>` compatibility and write load metrics as `<property>` values such as `load.threads`, `load.throughput`, and `load.snapshots.0.at`.

See [Reports — Load Test Report Schema](./reports.md#load-test-report-schema) for the generated report shape.

## Differences from suites

| Suite (`type: suite`) | Load Test (`type: loadtest`) |
|-----------------------|------------------------------|
| Uses `tests` | Uses `test` |
| Runs multiple APIs/tests/suites | Runs one `type: test` scenario repeatedly |
| Supports staged execution with `then` | Supports concurrency, ramp-up, and repeat limits |
| Can start suite-level mock servers | Does not have suite-level `servers` |
| Functional reports include `checks` | Load reports use root metrics and `snapshots` |

Use a suite when you want to orchestrate many files. Use a load test when you want to measure one scenario under repeated or concurrent execution.

## Reference (types)

- type: `loadtest`
- title: string
- description: string (supports Markdown)
- tags: string[]
- test: string (path to a `type: test` `.mmt` file)
- threads: number
- repeat: string | number
- rampup: string
- export: string[] (paths to report files)
- environment: object
  - preset: string
  - file: string
  - variables: object

---

## See also

- [Test](./test-mmt.md) — define the scenario that a load test runs
- [Suite](./suite-mmt.md) — group and run multiple tests, APIs, or suites
- [Reports](./reports.md#load-test-report-schema) — load report schema and export formats
- [Testlight CLI](./testlight.md) — run load tests and export reports from CI
- [Environment](./environment-mmt.md) — variables and presets, including `+/` project root imports
