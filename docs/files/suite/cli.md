# Running suites from the CLI

Use `testlight run` to run a suite from the command line or CI:

```sh
testlight run path/to/suite.mmt --env-file env.mmt --preset dev
```

Select tests by tag (replaces the suite file’s `filter:`):

```sh
testlight run path/to/suite.mmt --tag smoke --skip-tag flaky
```

`--tag` / `--skip-tag` are repeatable and accept comma-separated lists. See [Tag filter](./execution.md#tag-filter) and the [suite tag filter example](../../../examples/intermediate/29_suite_tag_filter/README.md).

Stages run sequentially; items within each stage run in parallel.

Configure env for suite runs with the root-only `environment:` field or CLI flags. See [Environment CLI](../env/cli.md) · [Suite exports](./exports.md).

See [Testlight — Options](../../features/testlight/options.md) · [Testlight](../../features/testlight/index.md) · [Execution](./execution.md)
