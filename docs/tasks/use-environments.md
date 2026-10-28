# Use environments

Keep base URLs and secrets out of request files. Define variables in a `type: env` file (often `multimeter.mmt` at the project root), then reference them with `e:name` or `<<e:name>>`.

## Minimal example

`multimeter.mmt`:

```yaml
type: env
variables:
  api_url:
    - https://test.mmt.dev
```

API `file:`

```yaml
type: api
url: <<e:api_url>>/json
method: get
format: json
```

Select the environment / preset in the Environment panel (or pass `--preset` / `-e` on the CLI).

## Tips

- Place `multimeter.mmt` at the project root so `+/` imports resolve correctly.
- Use presets to switch local / staging / production in one click when several **independent** variables must move together.
- Fields that must stay together for **API defaults** (e.g. latitude + longitude) belong in **one** nested choice (`city.berlin: {latitude, longitude}`), then API `e:city.latitude` — not two maps a preset tries to keep in sync.
- For env vs JSON vs values written in the test, see [Where values live](./start-a-project.md#where-values-live-env-vs-json-vs-direct).
- Never commit real secrets — use empty defaults and override in CI.

## Learn more

- [Environment files](../files/env/index.md)
- [Live variables](../files/env/live-variables.md) — `./….mmt` values that run another file on each read
- [OS variables](../files/env/os-variables.md) — whole-value `$VAR` refs from the host process env
- Examples: [Basic](/docs/examples/basic/03_environment_variables) · [Intermediate (presets, OS `$VAR`, live)](/docs/examples/intermediate/10_environment_variables)
