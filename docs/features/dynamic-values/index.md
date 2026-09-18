# Dynamic values

Use built-in **dynamic tokens** anywhere in `url`, `headers`, `body`, `query`, `cookies`, `inputs` defaults, mock-server responses, and test steps. Tokens resolve at runtime from environment variables, declared inputs, random generators, or the current clock/locale.

The single source of truth for token syntax and replacement is `core/src/variableReplacer.ts`. Random generators live in `core/src/Random.ts`; current/time generators in `core/src/Current.ts`.

## In this section

- [Syntax and accessors](./syntax.md) — token forms, accessors, name normalization
- [Random tokens (`r:`)](./random.md) — full generator reference
- [Current tokens (`c:`)](./current.md) — clock and locale generators

See also: [Environment](../../files/env/index.md) · [Inputs](../../files/api/inputs.md) · [Server tokens](../../files/server/tokens.md) · [Example: Dynamic values](../../../examples/intermediate/12_dynamic_values/)

## Token prefixes

| Prefix | Meaning | Defined in |
|--------|---------|------------|
| `e:` | Environment variable from a `type: env` file or runtime env | [Environment](../../files/env/index.md) |
| `i:` | Input declared under `inputs:` on the current API or test | [Inputs](../../files/api/inputs.md) |
| `o:` | Test `outputs` object (read anywhere; write via `set` keys) | [Variables](../../files/test/steps/variables.md) |
| `r:` | Random value (new per evaluation; see caching below) | [Random tokens](./random.md) |
| `c:` | Current date/time/locale value | [Current tokens](./current.md) |

**API docs only:** In API `description` text, `<<o:name>>` still documents an output field for generated docs — it does not substitute at API run time. In **tests**, `o:` / `<<o:name>>` are runtime tokens for the local `outputs` object (same as `${outputs.name}`). Step results use `${stepId.path}` (for example `${login.body.token}`). See [Outputs](../../files/api/outputs.md) and [check — output paths](../../files/test/steps/check.md#output-path-behavior).

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

Full env setup, presets, and type-preserving rules: [Environment](../../files/env/index.md).

## Input tokens (`i:`)

Reference keys declared under `inputs:` on the same API or test file. Defaults may themselves contain `e:`, `r:`, `c:`, or other `i:` tokens.

| Token | Meaning | Example |
|-------|---------|---------|
| `<<i:name>>` | Input value (string context) | `<<e:api_url>>/users/<<i:user_id>>` |
| `i:name` | Input value (standalone after `: `) | `username: i:username` |

Details, `omit` / `null`, and chaining: [Inputs](../../files/api/inputs.md).

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
