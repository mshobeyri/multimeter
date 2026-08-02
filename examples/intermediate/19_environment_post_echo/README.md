# Environment POST Echo

An intermediate environment-variable example that sends a POST request using env values in the URL, headers, and body.

## Files

| File | Description |
|---|---|
| `multimeter.mmt` | Defines `base_url` and `custom_header` variables |
| `post_echo.mmt` | POST request using `<<e:base_url>>/echo`, `e:custom_header`, and env accessors |

## How to use

### In VS Code

1. Open the Environment panel and load `multimeter.mmt`.
2. Open `post_echo.mmt`.
3. Click **Run**.

### With the CLI

```sh
npx testlight run examples/intermediate/19_environment_post_echo/post_echo.mmt \
  --env-file examples/intermediate/19_environment_post_echo/multimeter.mmt
```

## Key concepts

- **`e:var`** references an environment variable as the whole value.
- **`<<e:var>>`** embeds an environment variable inside a string.
- **Accessors** like `<<e:custom_header[0:5]>>` reuse part of an env value.

See [Environment docs](../../../docs/files/env.md) for full details.
