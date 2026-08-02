# Mock servers from the CLI

Mock server files (`type: server`) are not run directly. They start automatically when you run a test or suite that references them.

From a test (via `import` + `run` step):

```sh
testlight run path/to/test-with-mock.mmt --env-file env.mmt
```

From a suite (via `servers:` or a server item):

```sh
testlight run path/to/suite.mmt --env-file env.mmt --preset dev
```

See [Mock servers in tests](./in-tests.md) · [Mock servers in suites](./in-suites.md)
