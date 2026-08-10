# Environment variables on the CLI

Use `-F` / `--env-file` and `-P` / `--preset` to load variables from an env file, then override with `-e`:

```sh
testlight run tests/login.mmt -F env.mmt -P runner.dev
```

Apply multiple preset groups (same as the environment panel):

```sh
testlight run tests/login.mmt -F env.mmt -P runner.dev -P custom.prod
```

Override values explicitly (wins over preset):

```sh
testlight run tests/login.mmt -F env.mmt -P runner.dev \
  -e api_url=http://localhost:8080 -e user=bob
```

Without an env file, pass variables directly:

```sh
testlight run tests/login.mmt -e api_url=http://localhost:8080 -e user=alice -e pass='00123'
```

**Typing rules:** unquoted numbers and booleans are coerced (`true`, `42`); quoted values stay strings (`'00123'`).

See [Testlight — Options](../../features/testlight/options.md) · [Testlight — Environment priority](../../features/testlight/environment-priority.md) · [Testlight](../../features/testlight/index.md)
