# Running load tests from the CLI

Use `testlight run` to run a load test from the command line or CI:

```sh
testlight run path/to/loadtest.mmt --env-file env.mmt --preset perf
```

Generate a report explicitly:

```sh
testlight run path/to/loadtest.mmt --report html --report-file reports/load.html
```

If the load test file has an `export` field, reports are generated automatically after the run.

See [Testlight CLI — Options](../../running/testlight/options.md) · [Environment](./environment.md) · [Exports](./exports.md)
