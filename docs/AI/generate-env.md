This file tells the AI how to generate **`type: env`** `.mmt` files.

Environment files define variables and optional presets used by APIs and tests.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be `type: env`.
- Favor clear, descriptive variable names (snake_case), for example `api_url`, `auth_token`, `mode`, `city`.

---

## Schema (mental model for the AI)

This matches `EnvData` in `core/src/data/EnvData.ts` and `docs/files/env/index.md`.

Top-level keys and types:

```yaml
type: env                       # REQUIRED, must be exactly "env"

variables:                      # REQUIRED
  <name>:
    # One of:
    # 1) key-value map (named choices). Each choice value may be:
    #    - a scalar (string | number | boolean | null), or
    #    - a nested object/array (one concept with related fields)
    # 2) array of scalars (allowed values only — no nested objects in lists)

presets?:                       # OPTIONAL — omit when a single choice map is enough
  <presetGroup>:
    <presetName>:
      <env_name>: <choiceKey>   # must be a key from that variable’s map (or a list value)
```

Interpretation:
- `variables[NAME]` can be:
  - `{ local: "http://localhost:8080", prod: "https://test.mmt.dev" }` → scalar choices.
  - `{ berlin: { latitude: 52.52, longitude: 13.41 }, tokyo: { … } }` → **nested** choices (one concept).
  - `["debug", "info", "warn"]` → allowed-value list (scalars only).
- Without a preset, the **first** choice (or first list item) is the default.
- `presets[group][name]` tells the UI which choice key to pick for each variable when that preset is active. Use presets to bind **independent** variables together (e.g. `api_url` + `mode`). Do **not** invent a preset just to keep fields of one concept in sync — nest those fields under one variable instead.

---

## Tokens in other files

Env variables are **read in APIs/tests**, not stored as tokens here. In `type: api` or `type: test` files:

| Form | Use |
|---|---|
| `e:api_url` | Whole-value scalar (type preserved) |
| `<<e:api_url>>` | Inside strings / URLs |
| `e:city.latitude` / `<<e:city.latitude>>` | Property access on a nested choice value |

The AI should not put `e:` tokens into env files; here we only define raw values or options. Whole-value `$VAR` (OS process env) and `./….mmt` (live) are allowed as bare scalars or choice values — see [OS variables](../files/env/os-variables.md) and [Live variables](../files/env/live-variables.md).

---

## Common patterns the AI should generate

### 1. Simple local + prod configuration

```yaml
type: env
variables:
  api_url:
    local: "http://localhost:8080"
    prod: "https://test.mmt.dev"
  default_user:
    - "alice@example.com"
  default_password:
    - "secret"
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
    - true
    - false
  timeout_ms:
    - 1000
    - 2000
    - 5000
presets:
  runner:
    dev:
      mode: dev
      feature_x_enabled: true
      timeout_ms: 1000
    prod:
      mode: prod
      feature_x_enabled: false
      timeout_ms: 2000
```

### 3. Bundled concept (nested choice values) — prefer this over paired scalars

When several fields **must stay together** for **interactive API defaults** (location, tenant credentials, region+endpoint, etc.), define **one** env variable whose choices are nested objects. The Environment panel picks the whole concept; **API** defaults read fields with accessors.

**Do generate (env + API defaults):**

```yaml
# multimeter.mmt — interactive defaults for API Send
type: env
variables:
  api_url:
    local: "http://localhost:8080"
    prod: "https://test.mmt.dev"
  city:
    berlin:
      latitude: 52.52
      longitude: 13.41
    paris:
      latitude: 48.85
      longitude: 2.35
    tokyo:
      latitude: 35.68
      longitude: 139.69
  # no presets needed for city — picking "paris" sets both coordinates
```

```yaml
# type: api — defaults for Send / when a test omits an input
inputs:
  latitude: e:city.latitude
  longitude: e:city.longitude
```

**Where values live** (mother doc: [Start a Multimeter project — Where values live](../tasks/start-a-project.md#where-values-live-env-vs-json-vs-direct)):

- **Env** — user knobs + API Send defaults (`e:city.latitude` on APIs).
- **JSON** — fixed shared catalogs (Berlin lat/lon reused everywhere) → tests use `${cities.berlin.latitude}`, not `e:city…`.
- **Direct in the test** — scenario values that can be anything for that case (date windows, horizons) → literals in the test, not env and not a dates JSON file.

```yaml
# type: test — catalog from JSON; scenario dates direct
import:
  cities: +/cities.json
  api: +/api/forecast_current.mmt
steps:
  - call: api
    inputs:
      latitude: ${cities.berlin.latitude}
      longitude: ${cities.berlin.longitude}
      start_date: "2024-06-01"
```

**Do not generate** separate choice maps that can be selected independently (or a preset that only exists to keep them paired):

```yaml
# BAD — user can pick latitude=berlin and longitude=tokyo
variables:
  latitude:
    berlin: 52.52
    tokyo: 35.68
  longitude:
    berlin: 13.41
    tokyo: 139.69
presets:
  location:
    berlin:
      latitude: berlin
      longitude: berlin
```

Same nesting rule for any inseparable **API-default** bundle (e.g. `account: { alice: { id, token } }` → API `e:account.id`). Decide env vs JSON vs direct using [Where values live](../tasks/start-a-project.md#where-values-live-env-vs-json-vs-direct).

---

## How the AI should answer env-related questions

- Before adding an env variable, check [Where values live](../tasks/start-a-project.md#where-values-live-env-vs-json-vs-direct): user knob / API Send default → env; fixed shared catalog → JSON; scenario-only → not env.
- If the user wants to **switch between environments** (local/staging/prod), generate:
  - Variables with **key-value choice mappings**, e.g. `api_url: { local: ..., prod: ... }`.
  - A `runner` preset group with `local`, `staging`, `prod` entries that bind those **independent** variables.
- If several fields must stay together for **API defaults**, generate **one nested choice map** and accessors on the API (`e:name.field`). Skip a preset for that variable unless other independent keys need to switch with it.
- If the user wants **valid options** for a flag or numeric setting, use **arrays** of scalars.
- If a variable has only a single known value, wrap it in a single-element array (e.g. `token: ["your-token"]`) or a one-key map.
- Prefer real YAML types (numbers, booleans, nested objects) when the value should keep that type via bare `e:name` / `e:name.field`.

---

## Style rules for the AI

- Use 2-space indentation.
- Prefer snake_case variable names.
- Keep presets small and focused; do not create many unused presets.
- Prefer explicit URLs and modes instead of opaque values.
- Nested choice values: use clear field names that match how APIs/tests will read them (`latitude` / `longitude`, not cryptic abbreviations), unless the user asks otherwise.

When unsure, generate a **small env file** with the most clearly requested variables. Add a `runner` preset group only when two or more **independent** variables must switch together.

---

## Certificates (optional)

Env files can also contain a `certificates` section for SSL/TLS settings. The AI generally does not need to generate this unless the user specifically asks about TLS, mTLS, or client certificates. See `docs/features/certificates/index.md` for full details.

```yaml
certificates:
  server_ca: ./certs/ca.pem
  clients:
    - name: my-client
      host: api.example.com
      cert: ./certs/client.pem
      key: ./certs/client-key.pem
```
