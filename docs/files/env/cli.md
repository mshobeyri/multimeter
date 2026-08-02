# Environment variables on the CLI

Use `--env-file` and `--preset` to load variables from an env file, then override with `-e`:

```sh
testlight run tests/login.mmt --env-file env.mmt --preset runner.dev
```

Override values explicitly (wins over preset):

```sh
testlight run tests/login.mmt --env-file env.mmt --preset runner.dev \
  -e api_url=http://localhost:8080 -e user=bob
```

Without an env file, pass variables directly:

```sh
testlight run tests/login.mmt -e api_url=http://localhost:8080 -e user=alice -e pass='00123'
```

**Typing rules:** unquoted numbers and booleans are coerced (`true`, `42`); quoted values stay strings (`'00123'`).

See [Testlight — Options](../../features/testlight/options.md) · [Testlight — Environment priority](../../features/testlight/environment-priority.md) · [Testlight](../../features/testlight/index.md)
