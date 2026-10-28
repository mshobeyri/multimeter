# Environment Variables

Presets, OS process-env refs (`$VAR`), and live file-backed values (`./….mmt`) in one project — each concept in its own folder.

## Structure

```
10_environment_variables/
├── multimeter.mmt                 # Shared variables + presets
├── presets/
│   ├── api/echo_env.mmt           # <<e:api_url>>, e:mode
│   └── test/preset_test.mmt
├── os_variables/
│   ├── echo_path.mmt              # Posts e:path_from_os ($PATH) in the body
│   └── path_test.mmt
├── live_variables/
│   ├── create_session_api.mmt     # Live target (API → outputs.session)
│   ├── create_session_test.mmt    # Live target (test → outputs.session, cache: 2s)
│   ├── consume_session_test.mmt   # Asserts e:session_* look like UUIDs
│   └── consume_session_api.mmt    # Optional Send — body uses e:session_*
├── suite.mmt                      # preset + OS PATH + live consumers
└── README.md
```

## Files

| Path | Description |
|---|---|
| `multimeter.mmt` | Choices + presets; `path_from_os: $PATH`; live `session_*` → `./live_variables/…` |
| `presets/` | Presets — `api_url.local` is `https://local.mmt.dev`, staging is `https://test.mmt.dev` |
| `os_variables/` | OS `$PATH` echoed in the JSON **body** (not the URL) |
| `live_variables/` | Live `./….mmt` getters ([docs](../../../docs/files/env/live-variables.md)) |
| `suite.mmt` | Runs all three concepts |

## Key concepts

- **Presets** — `runner.dev` / `runner.staging` pick `api_url`, `mode`, `timeout`.
- **`$PATH`** — OS ref; consumers use `e:path_from_os` in the body. See [OS variables](../../../docs/files/env/os-variables.md).
- **`./….mmt`** — live getters; each `e:session_*` uses the target’s first `outputs:` key.
- **`<<e:var>>`** / **`e:var`** — inline string vs whole-value (type-preserving) substitution.

## How to use

### In VS Code

1. Open the folder (or repo) so `multimeter.mmt` loads as the workspace env.
2. Pick a preset (e.g. `runner.dev`) in the Environment panel.
3. Run `suite.mmt`, or files under `presets/`, `os_variables/`, `live_variables/`.
4. `path_from_os` shows an `(os)` chip; live paths show `(live)`.

### With the CLI

```sh
# Full suite
npx testlight run examples/intermediate/10_environment_variables/suite.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt \
  --preset runner.dev

# Presets only (local.mmt.dev in-process twin)
npx testlight run examples/intermediate/10_environment_variables/presets/test/preset_test.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt \
  --preset runner.dev

# OS PATH in the request body
npx testlight run examples/intermediate/10_environment_variables/os_variables/path_test.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt \
  --preset runner.dev

# Live variables
npx testlight run examples/intermediate/10_environment_variables/live_variables/consume_session_test.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt
```

Override a preset value:

```sh
npx testlight run examples/intermediate/10_environment_variables/presets/test/preset_test.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt \
  --preset runner.dev \
  -e mode=release
```
