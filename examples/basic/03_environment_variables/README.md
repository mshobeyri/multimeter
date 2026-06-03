# Environment Variables

A simple environment file with one plain variable. There are no presets in this basic example.

## Files

| File | Description |
|---|---|
| `multimeter.mmt` | Defines the `base_url` variable |
| `get_json.mmt` | GET request using `<<e:base_url>>/json` |

## How to use

### In VS Code

1. Open the Environment panel and load `multimeter.mmt`.
2. Open `get_json.mmt`.
3. Click **Run**.

### With the CLI

```sh
npx testlight run examples/basic/03_environment_variables/get_json.mmt \
  --env-file examples/basic/03_environment_variables/multimeter.mmt
```

Override the variable directly:

```sh
npx testlight run examples/basic/03_environment_variables/get_json.mmt \
  -e base_url=https://test.mmt.dev
```

## Key concepts

- **`<<e:var>>`** embeds an environment variable inside a string.
- POST requests with env headers are covered later in [Environment POST Echo](../../intermediate/19_environment_post_echo/).
- Presets are covered later in [Environment Presets](../../intermediate/10_environment_presets/).

See [Environment docs](../../../docs/environment-mmt.md) for full details.
