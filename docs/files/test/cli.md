# Running tests from the CLI

Use `testlight run` to execute a test from the command line or CI:

```sh
testlight run path/to/test.mmt --env-file env.mmt --preset dev
```

Override env values inline:

```sh
testlight run path/to/test.mmt -e api_url=http://localhost:8080 -e user=alice
```

Generate a report after the run:

```sh
testlight run path/to/test.mmt --report junit --report-file results.xml
```

See [Testlight CLI — Options](../../running/testlight/options.md) · [Reports — CLI](../report/cli.md) · [Environment CLI](../env/cli.md)
