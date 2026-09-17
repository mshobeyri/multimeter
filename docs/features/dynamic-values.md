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

Each prefix supports a **name** made of letters, digits, `_`, and `-` (must start with a letter or `_`). Names are case-sensitive in YAML, but `r:` and `c:` names are normalized when looked up (see [Name normalization](#name-normalization)). Supported `r:` and temporal `c:` tokens may append arguments in parentheses.

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

Random generators accept documented range/length arguments. Temporal current
tokens accept one signed duration offset:

```yaml
started_at: c:datetime(-1d2m1s)
expires_at: c:utc_datetime(+1h1m)
expires_epoch: c:epoch(+30m)
```

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
| `r:float` | Floating-point number `0`–`1000` | `42.75` |
| `r:string` | Alphabetic string (16 characters) | `aZbYcXwVuTsRqPon` |
| `r:alphanumeric` | Letters and digits (16 characters) | `aB3dE5gH7jK9mN2p` |

Parameterized forms:

| Token | Meaning |
|-------|---------|
| `r:int(1,100)` | Integer in the inclusive range 1–100 |
| `r:int(100)` | Integer in the inclusive range 0–100 |
| `r:float(1.5,9.5)` | Floating-point number in the range 1.5–9.5 |
| `r:string(32)` | Alphabetic string with length 32 |
| `r:alphanumeric(24)` | Alpha-numeric string with length 24 |
| `r:password(20)` | Password string with length 20 |
| `r:epoch(1700000000,1800000000)` | Unix seconds in an explicit inclusive range |
| `r:epoch_ms(1700000000000,1800000000000)` | Unix milliseconds in an explicit inclusive range |
| `r:date_future(1,30)` | Date between 1 and 30 days in the future |
| `r:date_past(1,30)` | Date between 1 and 30 days in the past |
| `r:date_future(2d,30d)` | Date between 2 and 30 days ahead (duration syntax) |
| `r:datetime_future(1d,7d)` | Local datetime between 1 and 7 days ahead |
| `r:datetime_past(2d,14d)` | Local datetime between 2 and 14 days ago |
| `r:utc_datetime_future(1d,7d)` | UTC datetime between 1 and 7 days ahead |
| `r:utc_datetime_past(2d,14d)` | UTC datetime between 2 and 14 days ago |
| `r:time_future(1h,6h)` | Local time between 1 and 6 hours ahead |
| `r:utc_time_past(30m,2h)` | UTC time between 30 minutes and 2 hours ago |
| `r:utc_date_future(7,30)` | UTC date between 7 and 30 days ahead |
| `r:epoch_future(2d,30d)` | Unix seconds between 2 and 30 days ahead |
| `r:epoch_past(1d,365d)` | Unix seconds between 1 day and 1 year ago |
| `r:datetime(2026-01-01,2026-12-31)` | Local datetime between two absolute local dates/times |
| `r:utc_datetime(2026-01-01T00:00:00Z,2026-12-31T23:59:59Z)` | UTC datetime between two absolute instants |
| `r:datetime_now(1h1m)` | Local datetime within ±1 hour 1 minute of now |
| `r:datetime_now(2h,1d)` | Local datetime from 2 hours ago through 1 day ahead |
| `r:utc_datetime_now(1h1m)` | UTC datetime within ±1 hour 1 minute of now |
| `r:utc_datetime_now(2h,1d)` | UTC datetime from 2 hours ago through 1 day ahead |
| `r:epoch_now(1h1m)` | Unix seconds within ±1 hour 1 minute of now |
| `r:epoch_now(2h,1d)` | Unix seconds from 2 hours ago through 1 day ahead |
| `r:epoch_now_ms(1h1m)` | Unix milliseconds within ±1 hour 1 minute of now |
| `r:epoch_now_ms(2h,1d)` | Unix milliseconds from 2 hours ago through 1 day ahead |

Invalid arguments and arguments on non-parameterized tokens remain unresolved
instead of silently producing a different value.

Relative-to-now ranges accept combined `w`, `d`, `h`, `m`, `s`, and `ms`
durations, for example `2d4h30m` or `1h1m`. For `*_now` tokens:

- **One argument** — symmetric range around now, e.g. `r:datetime_now(1h1m)` → ±1h1m
- **Two arguments** — back then forward from now, e.g. `r:datetime_now(2h,1d)` → from 2 hours ago through 1 day ahead
- **No arguments** — defaults to ±1 hour

### Network

| Token | Returns | Example |
|-------|---------|---------|
| `r:ip` | IPv4 address | `203.0.113.42` |
| `r:ipv6` | IPv6 address (8 groups) | `2001:0db8:85a3:0000:0000:8a2e:0370:7334` |
| `r:mac` | MAC address | `02:42:ac:11:00:02` |
| `r:domain` | Domain name | `example.com` |
| `r:hostname` | Host name | `api-a1b2c3d4.example.com` |
| `r:url` | HTTPS URL | `https://api-a1b2c3d4.example.com/x7y8z9` |
| `r:user_agent` | Common HTTP user-agent string | `curl/8.7.1` |

### People and contact

| Token | Returns | Example |
|-------|---------|---------|
| `r:email` | Email address | `jane.doe42@example.com` |
| `r:username` | Name-based username | `jane.doe42` |
| `r:password` | Password string (16 characters) | `aB3!dE5_fG7+hJ9` |
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
| `r:postal_code` | Five-digit postal code | `10115` |
| `r:street_address` | Synthetic street address | `42 Miller Street` |

### Business and text

| Token | Returns | Example |
|-------|---------|---------|
| `r:company` | Synthetic company name | `Miller Technologies` |
| `r:job_title` | Software/business job title | `Backend Engineer` |
| `r:word` | Word from a technical vocabulary | `gateway` |
| `r:sentence` | Synthetic sentence | `Request data flows through the gateway.` |
| `r:paragraph` | Three to six synthetic sentences | `Request data ... Service response ...` |

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
| `r:time` | Random local time `HH:MM:SS`; optional absolute from/to range | `08:30:12` |
| `r:utc_time` | Random UTC time `HH:MM:SS`; optional absolute from/to range | `18:30:12` |
| `r:date` | Random local date `YYYY-MM-DD`; optional absolute from/to range | `2027-04-14` |
| `r:utc_date` | Random UTC date `YYYY-MM-DD`; optional absolute from/to range | `2027-04-14` |
| `r:date_future` | Future date string (~1–365 days ahead) | `Mon Apr 14 2027 …` |
| `r:date_past` | Past date string (~1 day–5 years back) | `Tue Jan 09 2021 …` |
| `r:datetime` | Random local datetime; accepts an absolute local from/to range | `2027-04-14T08:30:12` |
| `r:utc_datetime` | Random UTC datetime; accepts an absolute from/to range | `2027-04-14T08:30:12Z` |
| `r:datetime_future` | Random local datetime in the future; duration or day-count window | `2026-09-19T12:00:00` |
| `r:datetime_past` | Random local datetime in the past; duration or day-count window | `2026-09-15T12:00:00` |
| `r:utc_datetime_future` | Random UTC datetime in the future | `2026-09-19T12:00:00Z` |
| `r:utc_datetime_past` | Random UTC datetime in the past | `2026-09-15T12:00:00Z` |
| `r:time_future` | Random local time in the future | `13:00:00` |
| `r:time_past` | Random local time in the past | `11:00:00` |
| `r:utc_time_future` | Random UTC time in the future | `13:00:00` |
| `r:utc_time_past` | Random UTC time in the past | `11:00:00` |
| `r:utc_date_future` | Random UTC date in the future | `2026-09-24` |
| `r:utc_date_past` | Random UTC date in the past | `2026-09-10` |
| `r:datetime_now` | Random local datetime around now; one duration for ±range, or back then forward | `2026-09-17T12:25:00` |
| `r:utc_datetime_now` | Random UTC datetime around now; one duration for ±range, or back then forward | `2026-09-17T10:25:00Z` |

### Epoch (random timestamps)

| Token | Returns | Range / meaning |
|-------|---------|-----------------|
| `r:epoch` | Unix seconds (integer) | Defaults to 2000–2035; accepts explicit epoch range |
| `r:epoch_ms` | Unix milliseconds (integer) | Defaults to 2000–2035; accepts explicit epoch range |
| `r:epoch_future` | Unix seconds | ~1–365 days in the future |
| `r:epoch_future_ms` | Unix milliseconds | ~1–365 days in the future |
| `r:epoch_past` | Unix seconds | ~1 day–5 years in the past |
| `r:epoch_past_ms` | Unix milliseconds | ~1 day–5 years in the past |
| `r:epoch_now` | Unix seconds around now; one duration for ±range, or back then forward | `r:epoch_now(2h,1d)` |
| `r:epoch_now_ms` | Unix milliseconds around now; one duration for ±range, or back then forward | `r:epoch_now_ms(2h,1d)` |

Future/past random tokens accept **day counts** (`7`, `30`) or **combined durations** (`2d4h`, `1h30m`). One argument sets the maximum offset from now; two arguments set a min/max window.

**Total:** 62 token names (`phone_number` is an alias for `phone`).

## Current tokens (`c:`)

Each name maps to a generator in `CURRENT_TOKEN_MAP`. Values reflect **now** in the runtime locale/time zone unless noted.

Temporal current tokens accept a signed offset such as `(+1h1m)` or
`(-1d2m1s)`. The sign applies to the complete duration. Combined durations
support `w`, `d`, `h`, `m`, `s`, and `ms`.

Examples:

- `c:date(+7d)`
- `c:datetime(-1d2m1s)`
- `c:utc_datetime(+1h1m)`
- `c:epoch(-30m)`

**Future/past aliases** use unsigned durations instead of signed offsets:

- `c:datetime_future(1h)` — one hour ahead
- `c:utc_datetime_past(2d)` — two days ago
- `c:epoch_future(30m)` — 30 minutes ahead
- `c:time_past(15m)` — 15 minutes ago

Offsets apply to date/time, weekday, month, year, epoch, and UTC-offset tokens.
They are intentionally rejected for `c:city`, `c:country`, and `c:timezone`.

| Token | Returns | Example |
|-------|---------|---------|
| `c:time` | Local time `HH:MM:SS` | `14:32:08` |
| `c:date` | Local date `YYYY-MM-DD` | `2026-08-02` |
| `c:datetime` | Local date and time `YYYY-MM-DDTHH:MM:SS` | `2026-08-02T14:32:08` |
| `c:datetime_ms` | Local date and time with milliseconds | `2026-08-02T14:32:08.123` |
| `c:utc_time` | UTC time `HH:MM:SS` | `18:32:08` |
| `c:utc_date` | UTC date `YYYY-MM-DD` | `2026-08-02` |
| `c:utc_datetime` | UTC ISO date and time | `2026-08-02T18:32:08Z` |
| `c:utc_datetime_ms` | UTC ISO date and time with milliseconds | `2026-08-02T18:32:08.123Z` |
| `c:day` | Local weekday name | `Sunday` |
| `c:weekday_number` | ISO weekday number (Monday=1, Sunday=7) | `7` |
| `c:month` | Local month name | `August` |
| `c:year` | Local year (number) | `2026` |
| `c:epoch` | Unix seconds now (integer) | `1754165528` |
| `c:epoch_ms` | Unix milliseconds now (integer) | `1754165528123` |
| `c:timezone` | IANA runtime time zone | `Europe/Amsterdam` |
| `c:utc_offset` | Local offset from UTC | `+02:00` |
| `c:city` | City inferred from time zone (best effort) | `New York` |
| `c:country` | Country inferred from locale (best effort) | `United States` |

Future/past aliases (`c:datetime_future`, `c:utc_datetime_past`, `c:epoch_future`, `c:time_past`, and UTC variants) accept one unsigned duration argument.

**Total:** 18 generators plus 20 future/past aliases.

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
