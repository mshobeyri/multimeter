# Running

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
