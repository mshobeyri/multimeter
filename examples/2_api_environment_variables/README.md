# API with Environment Variables

This example shows how to use **environment variables** in `.mmt` API files so you can switch between servers (local, cloud, staging…) without editing your APIs.

## Files

| File | Description |
|---|---|
| `multimeter.mmt` | Defines `base_url` and `custom_header` variables with `local` / `cloud` presets |
| `get_json.mmt` | GET request using `<<e:base_url>>/json` |
| `post_echo.mmt` | POST request using `<<e:base_url>>/echo` |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. In the **Environment** panel, load `multimeter.mmt` and pick a preset (`server.local` or `server.cloud`).
3. Click **Run** on an API file.

### With the CLI

Run against the cloud server (default):

```sh
npx testlight run examples/2_api_environment_variables/get_json.mmt \
  --env-file examples/2_api_environment_variables/multimeter.mmt \
  --preset server.cloud
```

Run against a local server:

```sh
npx testlight run examples/2_api_environment_variables/get_json.mmt \
  --env-file examples/2_api_environment_variables/multimeter.mmt \
  --preset server.local
```

Override a variable directly:

```sh
npx testlight run examples/2_api_environment_variables/get_json.mmt \
  -e base_url=https://test.mmt.dev
```

## Key concepts

- **`e:var`** — reference an env variable as the entire value (preserves type).
- **`<<e:var>>`** — embed an env variable inside a string (e.g., a URL).
- **Presets** — named groups of variable overrides you can switch between.

See [Environment docs](../../docs/environment-mmt.md) for full details.
