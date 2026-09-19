# Syntax and accessors

Each token prefix supports a **name** made of letters, digits, `_`, and `-` (must start with a letter or `_`). Names are case-sensitive in YAML, but `r:` and `c:` names are normalized when looked up (see [Name normalization](#name-normalization)). Supported `r:` and temporal `c:` tokens may append arguments in parentheses.

See also: [Dynamic values overview](./index.md) · [Random tokens](./random.md) · [Current tokens](./current.md)

## Environment (`e:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<e:api_url>>` | Use inside strings (URLs, header values, body text) |
| Single angle brackets | `<e:token>` | Env only |
| Brace form | `e:{token}` | Env only |
| Plain | `e:api_url` | Standalone value after `: ` preserves type; also works mid-string after word boundaries |

## Inputs (`i:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<i:user_id>>` | Use inside strings |
| Plain | `i:user_id` | Entire value after `: ` only (not inside arbitrary text like `hi:i:user_id`) |

## Outputs (`o:`) — tests only

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

## Random (`r:`) and current (`c:`)

| Form | Example | Notes |
|------|---------|-------|
| Angle brackets | `<<r:uuid>>`, `<<c:date>>` | Use inside strings |
| Plain | `r:uuid`, `c:epoch` | Entire value after `: ` preserves native type |

Random generators accept documented range/length arguments — see [Random tokens](./random.md). Temporal current tokens accept signed or future/past duration offsets — see [Current tokens](./current.md).

```yaml
started_at: c:datetime(-1d2m1s)
expires_at: c:utc_datetime(+1h1m)
expires_epoch: c:epoch(+30m)
```

Examples mixing prefixes:

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

## Name normalization

For `r:` and `c:` lookups only, names are normalized before matching:

- camelCase → snake_case (`firstName` → `first_name`)
- hyphens and spaces → underscores (`my-token` → `my_token`)
- lowercased (`ALLCAPS` → `allcaps`)

So `r:first-name`, `r:first_name`, and `r:firstName` all resolve to the same generator. Environment and input names are **not** normalized — use the exact key from `variables:` / `inputs:`.
