# Run in CI

The same `.mmt` files you edit in VS Code run in CI with the Multimeter CLI called `testlight`. 

## Minimal example

```sh
npm install -g mmt-testlight
testlight run tests/smoke.mmt --env-file ci.env
```

Or without a global install:

```sh
npx mmt-testlight run suite.mmt --preset ci
```

## GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: mshobeyri/multimeter/.github/actions/testlight@main
  with:
    file: tests/suite.mmt
    env-file: tests/env.mmt
    report: junit
    report-file: results/junit.xml
```

See the [action README](https://github.com/mshobeyri/multimeter/blob/main/.github/actions/testlight/README.md).

## Typical flags

| Flag | Purpose |
|---|---|
| `--env-file` | Load environment variables from a file |
| `--preset` | Select a named preset from your env file |
| `-e key=VALUE` | Override a single variable |
| `--junit` / report flags | Emit CI-friendly reports |

See [Install](../install.md) and [Downloads](/downloads) for platform packages (Homebrew, apt, Docker, …).

## Tips

- Fail the job when the CLI exits non-zero.
- Keep secrets in the CI secret store; inject with `-e` or an env file that is not committed.
- Prefer running a suite so one command covers smoke or regression.

## Learn more

- [Testlight](../features/testlight/index.md) — install, commands, options, and CI examples
- [Install](../install.md)
- [Examples](/docs/examples)
