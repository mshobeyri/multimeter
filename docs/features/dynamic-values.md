# Dynamic values

Use built-in **dynamic tokens** anywhere in `url`, `headers`, `body`, `query`, `cookies`, `inputs` defaults, mock-server responses, and test steps. Tokens resolve at runtime from environment variables, declared inputs, random generators, or the current clock/locale.

The single source of truth for token syntax and replacement is `core/src/variableReplacer.ts`. Random generators live in `core/src/Random.ts`; current/time generators in `core/src/Current.ts`.

See also: [Environment](../files/env/index.md) · [Inputs](../files/api/inputs.md) · [Server tokens](../files/server/tokens.md)

## Token prefixes

| Prefix | Meaning | Defined in |
|--------|---------|------------|
| `e:` | Environment variable from a `type: env` file or runtime env | [Environment](../files/env/index.md) |
| `i:` | Input declared under `inputs:` on the current API or test | [Inputs](../files/api/inputs.md) |
| `o:` | Test `outputs` object (read anywhere; write via `set` keys) | [Variables](../files/test/steps/variables.md) |
| `r:` | Random value (new per evaluation; see caching below) | `Random.ts` |
| `c:` | Current date/time/locale value | `Current.ts` |

**API docs only:** In API `description` text, `<<o:name>>` still documents an output field for generated docs — it does not substitute at API run time. In **tests**, `o:` / `<<o:name>>` are runtime tokens for the local `outputs` object (same as `${outputs.name}`). Step results use `${stepId.path}` (for example `${login.body.token}`). See [Outputs](../files/api/outputs.md) and [check — output paths](../files/test/steps/check.md#output-path-behavior).

## Syntax forms

Each prefix supports a **name** made of letters, digits, `_`, and `-` (must start with a letter or `_`). Names are case-sensitive in YAML, but `r:` and `c:` names are normalized when looked up (see [Name normalization](#name-normalization)).

### Environment (`e:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<e:api_url>>` | Use inside strings (URLs, header values, body text) |
| Single angle brackets | `<e:token>` | Env only |
| Brace form | `e:{token}` | Env only |
| Plain | `e:api_url` | Standalone value after `: ` preserves type; also works mid-string after word boundaries |

### Inputs (`i:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<i:user_id>>` | Use inside strings |
| Plain | `i:user_id` | Entire value after `: ` only (not inside arbitrary text like `hi:i:user_id`) |

### Outputs (`o:`) — tests only

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<o:token>>` | Read `outputs.token` inside strings |
| Plain | `o:token` | Standalone value / check expressions |
| Set key | `o:token: value` or `o:user.name: value` | Writes `outputs.token` / `outputs.user.name` (only on `set`) |

```yaml
outputs:
  token: null
  user: null

steps:
  - set:
      o:token: "abc"
      o:user.name: "alice"
  - print: "token=<<o:token>>"
  - check: <<o:token>> == "abc"
```

Equivalent JS forms `${outputs.token}` and `${outputs.user.name}` remain valid.

### Random (`r:`) and current (`c:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<r:uuid>>`, `<<c:date>>` | Use inside strings |
| Plain | `r:uuid`, `c:epoch` | Entire value after `: ` preserves native type |

Examples:

```yaml
url: <<e:api_url>>/users/<<i:user_id>>
headers:
  X-Req: req-<<r:uuid>>
  X-Now: <<c:date>> <<c:time>>
body:
  id: r:int
  created_at: c:epoch
  active: r:bool
  username: i:username
```

## Accessors

Append an accessor path after the token name to use part of a string, array, or object value. Supported on all prefixes (`e:`, `i:`, `o:`, `r:`, `c:`).

| Accessor | Example | Meaning |
|----------|---------|---------|
| Property | `<<e:user.name>>` | Object field access |
| Index | `<<i:tags[0]>>` | Array index or string character |
| Slice | `<<e:token[0:6]>>` | JS `slice(start, end)` — end-exclusive |
| Open start | `<<i:message[:4]>>` | From start through index 4 |
| Open end | `<<i:message[1:]>>` | From index 1 through end |
| Bracket key | `<<e:data[key]>>` | Property when name is a valid identifier |

```yaml
headers:
  Authorization: Bearer <<e:token>>
  X-Token-Prefix: <<e:token[0:6]>>
inputs:
  username: alice
  role: admin
body:
  user_initial: <<i:username[0]>>
  role_short: <<i:role[0:3]>>
```

Input defaults can compose sibling inputs and env vars across multiple resolution passes:

```yaml
inputs:
  card: e:card
  seq: e:seq
  short: <<i:card[0:4]>>
  id: <<i:card>>_<<i:seq>>
```

## Resolution rules

| Situation | Behavior |
|-----------|----------|
| Entire field value is one token (e.g. `body: r:int`) | Native type preserved (`number`, `boolean`, `string`, …) |
| Token appears inside other text (e.g. `X-Id: user-<<r:uuid>>`) | Substituted as string |
| Missing env/input key | Original token text kept (e.g. `<<e:missing>>`) |
| Unknown `r:` / `c:` name | Original token text kept |
| UI editing | Random and current values are cached per render so previews stay stable while you type |
| CLI / test run | Random values are evaluated fresh per run (no cross-run cache) |

`{{var}}` (Postman/Bruno style) is **not** supported — use `e:` / `<<e:var>>` instead.

## Environment tokens (`e:`)

Reference variables from a `type: env` file, suite `environment`, VS Code Environment panel, or CLI `--env-file` / `-e`.

| Token | Meaning | Example value |
|-------|---------|---------------|
| `e:var` / `<<e:var>>` | Named environment variable | `https://test.mmt.dev` |
| `e:{var}` | Same as plain form (alternate syntax) | — |
| `<e:var>` | Same as `<<e:var>>` (alternate syntax) | — |

Full env setup, presets, and type-preserving rules: [Environment](../files/env/index.md).

## Input tokens (`i:`)

Reference keys declared under `inputs:` on the same API or test file. Defaults may themselves contain `e:`, `r:`, `c:`, or other `i:` tokens.

| Token | Meaning | Example |
|-------|---------|---------|
| `<<i:name>>` | Input value (string context) | `<<e:api_url>>/users/<<i:user_id>>` |
| `i:name` | Input value (standalone after `: `) | `username: i:username` |

Details, `omit` / `null`, and chaining: [Inputs](../files/api/inputs.md).

## Random tokens (`r:`)

Each name maps to a generator in `RANDOM_TOKEN_MAP`. Unless noted, values are **strings**. Token names accept underscores, hyphens, and camelCase aliases via [normalization](#name-normalization) (e.g. `r:firstName` → `first_name`).

### Identifiers and primitives

| Token | Returns | Example |
|-------|---------|---------|
| `r:uuid` | UUID v4 string | `a1b2c3d4-e5f6-4789-a012-3456789abcde` |
| `r:bool` | Boolean | `true` |
| `r:int` | Integer `0`–`1000` | `742` |

### Network

| Token | Returns | Example |
|-------|---------|---------|
| `r:ip` | IPv4 address | `203.0.113.42` |
| `r:ipv6` | IPv6 address (8 groups) | `2001:0db8:85a3:0000:0000:8a2e:0370:7334` |

### People and contact

| Token | Returns | Example |
|-------|---------|---------|
| `r:email` | Email address | `jane.doe42@example.com` |
| `r:phone` | E.164 phone number | `+14155550123` |
| `r:phone_number` | Alias for `r:phone` | `+442071234567` |
| `r:first_name` | First name | `Jane` |
| `r:last_name` | Last name | `Doe` |
| `r:full_name` | `"<first> <last>"` | `Jane Doe` |

### Place and geo

| Token | Returns | Example |
|-------|---------|---------|
| `r:city` | City name (curated list) | `Berlin` |
| `r:country` | Country name (curated list) | `Germany` |
| `r:latitude` | Number, −90…90 | `48.8566` |
| `r:longitude` | Number, −180…180 | `2.3522` |

### Color

| Token | Returns | Example |
|-------|---------|---------|
| `r:color` | CSS color name (palette) | `teal` |
| `r:hex_color` | `#RRGGBB` hex color | `#1a2b3c` |

### Calendar (random, not “now”)

| Token | Returns | Example |
|-------|---------|---------|
| `r:weekday` | Weekday name | `Wednesday` |
| `r:month` | Month name | `March` |
| `r:date_future` | Future date string (~1–365 days ahead) | `Mon Apr 14 2027 …` |
| `r:date_past` | Past date string (~1 day–5 years back) | `Tue Jan 09 2021 …` |
| `r:date_recent` | Recent date string (~0–30 days back) | `Fri Jul 25 2025 …` |

### Epoch (random timestamps)

| Token | Returns | Range / meaning |
|-------|---------|-----------------|
| `r:epoch` | Unix seconds (integer) | Random between 2000 and 2035 |
| `r:epoch_ms` | Unix milliseconds (integer) | Random between 2000 and 2035 |
| `r:epoch_future` | Unix seconds | ~1–365 days in the future |
| `r:epoch_future_ms` | Unix milliseconds | ~1–365 days in the future |
| `r:epoch_past` | Unix seconds | ~1 day–5 years in the past |
| `r:epoch_past_ms` | Unix milliseconds | ~1 day–5 years in the past |
| `r:epoch_recent` | Unix seconds | ~0–30 days in the past |
| `r:epoch_recent_ms` | Unix milliseconds | ~0–30 days in the past |

**Total:** 28 generators (`phone_number` is an alias for `phone`).

## Current tokens (`c:`)

Each name maps to a generator in `CURRENT_TOKEN_MAP`. Values reflect **now** in the runtime locale/time zone unless noted.

| Token | Returns | Example |
|-------|---------|---------|
| `c:time` | Local time `HH:MM:SS` | `14:32:08` |
| `c:date` | Local date `YYYY-MM-DD` | `2026-08-02` |
| `c:day` | Local weekday name | `Sunday` |
| `c:month` | Local month name | `August` |
| `c:year` | Local year (number) | `2026` |
| `c:epoch` | Unix seconds now (integer) | `1754165528` |
| `c:epoch_ms` | Unix milliseconds now (integer) | `1754165528123` |
| `c:city` | City inferred from time zone (best effort) | `New York` |
| `c:country` | Country inferred from locale (best effort) | `United States` |

**Total:** 9 generators.

## Name normalization

For `r:` and `c:` lookups only, names are normalized before matching:

- camelCase → snake_case (`firstName` → `first_name`)
- hyphens and spaces → underscores (`my-token` → `my_token`)
- lowercased (`ALLCAPS` → `allcaps`)

So `r:first-name`, `r:first_name`, and `r:firstName` all resolve to the same generator. Environment and input names are **not** normalized — use the exact key from `variables:` / `inputs:`.

## Where tokens work

| Location | `e:` | `i:` | `r:` | `c:` |
|----------|------|------|------|------|
| API / test `url`, `headers`, `body`, `query`, `cookies` | ✓ | ✓ | ✓ | ✓ |
| API / test `inputs` defaults | ✓ | ✓ (siblings) | ✓ | ✓ |
| Mock server responses, match rules, `port`, `protocol` | ✓ | — | ✓ | ✓ |
| Test `call` step `inputs` | ✓ | ✓ | ✓ | ✓ |

CLI (`testlight`) and the VS Code extension resolve tokens through the same core pipeline.

## Complete example

```yaml
type: api
title: Create user
inputs:
  domain: e:email_domain
  username: r:first_name
  email: <<i:username>>@<<i:domain>>
protocol: http
method: post
url: <<e:api_url>>/users
headers:
  X-Request-Id: req-<<r:uuid>>
  X-Sent-At: <<c:date>>T<<c:time>>
body:
  username: i:username
  email: i:email
  age: r:int
  active: r:bool
  created_at: c:epoch_ms
  meta:
    client_ip: r:ip
    location:
      lat: r:latitude
      lon: r:longitude
```
