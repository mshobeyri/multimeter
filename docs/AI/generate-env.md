This file tells the AI how to generate **`type: env`** `.mmt` files.

Environment files define variables and presets used by APIs and tests.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be `type: env`.
- Favor clear, descriptive variable names (snake_case or SCREAMING_SNAKE_CASE), for example:
  - `api_url`, `auth_token`, `mode`, or
  - `API_URL`, `AUTH_TOKEN`, `MODE`.

---

## Schema (mental model for the AI)

This matches `EnvironmentData` in `mmtview/src/environment/EnvironmentData.tsx` and `docs/environment-mmt.md`.

Top-level keys and types:

```yaml
type: env                       # REQUIRED, must be exactly "env"

variables:                      # REQUIRED
  <NAME>:
    # One of:
    # 1) scalar string (simple default)
    # 2) mapping of labels -> string values (choices)
    # 3) array of strings (allowed values)

presets?:                       # OPTIONAL
  <presetGroup>:
    <presetName>:
      <ENV_NAME>: string        # value *must* match one of the variable options
```

Interpretation:
- `variables[NAME]` can be:
  - `"value"` → simple scalar value.
  - `{ dev: "http://localhost:8080", prod: "https://api.example.com" }` → named choices.
  - `["debug", "info", "warn"]` → a list of allowed values.
- `presets[group][name]` tells the UI what to pick for each variable when that preset is active.

---

## Tokens in other files

Env variables are **read in APIs/tests**, not stored as tokens here. In `type: api` or `type: test` files, you read them with:

- `e:api_url`        # standalone value
- `<<e:api_url>>`    # inside strings/URLs

The AI should not put `e:` tokens into env files; here we only define raw values or options.

---

## Common patterns the AI should generate

### 1. Simple local + prod configuration

```yaml
type: env
variables:
  api_url:
    local: "http://localhost:8080"
    prod: "https://api.example.com"
  default_user: "alice@example.com"
  default_password: "secret"
  log_level:
    - debug
    - info
    - warn
    - error
presets:
  runner:
    local:
      api_url: local
      log_level: debug
    prod:
      api_url: prod
      log_level: info
```

### 2. Testing modes and feature flags

```yaml
type: env
variables:
  mode:
    dev: dev
    staging: staging
    prod: prod
  feature_x_enabled:
    - "true"
    - "false"
  timeout_ms:
    - "1000"
    - "2000"
    - "5000"
presets:
  runner:
    dev:
      mode: dev
      feature_x_enabled: "true"
      timeout_ms: "1000"
    prod:
      mode: prod
      feature_x_enabled: "false"
      timeout_ms: "2000"
```

---

## How the AI should answer env-related questions

- If the user wants to **switch between environments** (local/staging/prod), generate:
  - Variables with **choice mappings**, e.g. `API_URL: { local: ..., prod: ... }`.
  - A `runner` preset group with `local`, `staging`, `prod` entries.
- If the user wants **valid options** for a flag or numeric setting, use **arrays** of strings.
- Always keep values as strings in env files; typing happens when they are read and interpreted.

---

## Style rules for the AI

- Use 2-space indentation.
- Use ALL_CAPS for variable names by convention (not enforced but clearer).
- Keep presets small and focused; do not create many unused presets.
- Prefer explicit URLs and modes instead of opaque values.

When unsure, generate a **small env file** with the most clearly requested variables and a single preset group named `runner` with 1–2 named presets.
