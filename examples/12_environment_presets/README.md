# Environment Presets

Shows how to use **environment files**, **presets**, and **project root imports** (`+/`) to manage configuration across environments.

## Structure

```
12_environment_presets/
├── multimeter.mmt               # Project root marker + env variables + presets
├── api/
│   └── echo_env.mmt             # API using <<e:api_url>> and e:mode tokens
├── test/
│   └── preset_test.mmt          # Test using +/ project root imports
└── README.md
```

## Files

| File | Description |
|---|---|
| `multimeter.mmt` | Defines `api_url`, `mode`, and `timeout` variables with named choices, plus `runner.dev` and `runner.staging` presets |
| `api/echo_env.mmt` | Uses `<<e:api_url>>` in the URL and `e:mode` in the body |
| `test/preset_test.mmt` | Imports the API via `+/api/echo_env.mmt` (project root path) and runs it |

## Key concepts

- **`type: env`** — defines variables with named choices (key-value map) or allowed values (array).
- **Presets** — named groups that select specific variable choices. `runner.dev` picks `api_url: local` and `mode: dev`.
- **`<<e:var>>`** — inline string substitution (always a string).
- **`e:var`** — entire-value substitution (preserves type: number, boolean, string).
- **`multimeter.mmt`** — acts as the project root marker. Enables `+/` imports that resolve relative to this file.
- **`+/` imports** — `+/api/echo_env.mmt` resolves relative to where `multimeter.mmt` lives, regardless of directory depth.

## How to use

### In VS Code

1. Open the folder in VS Code. The `multimeter.mmt` file is auto-loaded as the workspace environment.
2. Use the **Environment** panel to pick a preset (e.g., `runner.dev`).
3. Open `test/preset_test.mmt` and click **Run**.

### With the CLI

```sh
# Use the dev preset
npx testlight run examples/12_environment_presets/test/preset_test.mmt \
  --env-file examples/12_environment_presets/multimeter.mmt \
  --preset runner.dev

# Use the staging preset
npx testlight run examples/12_environment_presets/test/preset_test.mmt \
  --env-file examples/12_environment_presets/multimeter.mmt \
  --preset runner.staging

# Override a variable explicitly
npx testlight run examples/12_environment_presets/test/preset_test.mmt \
  --env-file examples/12_environment_presets/multimeter.mmt \
  --preset runner.dev \
  -e mode=release
```
