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

API file:

```yaml
type: api
url: <<e:api_url>>/json
method: get
format: json
```

Select the environment / preset in the Environment panel (or pass `--preset` / `-e` on the CLI).

## Tips

- Place `multimeter.mmt` at the project root so `+/` imports resolve correctly.
- Use presets to switch local / staging / production in one click.
- Never commit real secrets — use empty defaults and override in CI.

## Learn more

- [Environment files](../files/env.md)
- Example: [Environment Variables](/docs/examples/basic/03_environment_variables)
