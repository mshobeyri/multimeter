# Running APIs from the CLI

Use `testlight run` to send an API request from the command line:

```sh
testlight run path/to/api.mmt --env-file env.mmt --preset dev
```

Run a named example:

```sh
testlight run path/to/api.mmt --example happy-path
testlight run path/to/api.mmt --example '#1'
```

Pass runtime inputs and env overrides:

```sh
testlight run path/to/api.mmt -i user_id=42 --env-file env.mmt -e api_url=http://localhost:8080
```

See [Testlight — Options](../../features/testlight/options.md) · [Testlight](../../features/testlight/index.md) · [Environment CLI](../env/cli.md)
