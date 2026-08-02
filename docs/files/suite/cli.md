# Running suites from the CLI

Use `testlight run` to run a suite from the command line or CI:

```sh
testlight run path/to/suite.mmt --env-file env.mmt --preset dev
```

Stages run sequentially; items within each stage run in parallel.

Configure env for suite runs with the root-only `environment:` field or CLI flags. See [Environment CLI](../env/cli.md) · [Suite exports](./exports.md).

See [Testlight CLI — Options](../../running/testlight/options.md) · [Execution](./execution.md)
