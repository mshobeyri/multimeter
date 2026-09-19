# Dynamic Values

Demonstrates built-in `r:` (random) and `c:` (current) tokens in YAML files. These tokens resolve at runtime without a `js` step.

Random tokens are split by kind. Current tokens live in their own test. Nearby random/current timestamps are checked with `=5s~`.

## Structure

```
12_dynamic_values/
├── api/
│   ├── random_types.mmt         # Primitive and identifier r: tokens
│   ├── random_network.mmt       # Network r: tokens
│   ├── random_identity.mmt      # People, place, business, and text r: tokens
│   ├── random_time.mmt          # Calendar and epoch r: tokens plus current times
│   └── current.mmt              # c: clock and locale tokens
├── random_types_test.mmt
├── random_network_test.mmt
├── random_identity_test.mmt
├── random_time_test.mmt
├── current_test.mmt
├── suite.mmt
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/random_types.mmt` | `r:uuid`, `r:int`, `r:bool`, `r:float`, `r:alphanumeric`, `r:password` |
| `api/random_network.mmt` | `r:domain`, `r:url`, `r:mac`, `r:ip`, `r:hostname`, `r:user_agent` |
| `api/random_identity.mmt` | `r:email`, names, address, company, and text tokens |
| `api/random_time.mmt` | Ranged and near-now datetimes/epochs, plus `c:` times for proximity |
| `api/current.mmt` | `c:utc_datetime`, offsets such as `(+2s)` / `(+1h)`, date, time, epoch, timezone |
| `*_test.mmt` | Calls the matching API and validates the echoed values |
| `suite.mmt` | Runs every dynamic-values test together |

## Example tokens

```yaml
body:
  id: r:uuid
  lucky_number: r:int(10,20)
  email: r:email
  random_url: r:url
  datetime_near_now: r:utc_datetime_now(2s)
  created_utc: c:utc_datetime
  created_utc_plus_2s: c:utc_datetime(+2s)
```

```yaml
- check: ${result.datetime_near_now} =5s~ ${result.created_utc}
- check: ${result.created_utc} !5s~ ${result.created_utc_plus_1h}
```

## Key concepts

- **Standalone tokens** keep their native type. For example, `r:int` becomes a number and `r:bool` becomes a boolean.
- **Embedded tokens** must use `<< >>`. In this example, `req-<<r:uuid>>` generates a string with a random suffix.
- **Parameterized generators** use parentheses for lengths and ranges, such as `r:int(10,20)` and `r:alphanumeric(12)`.
- **Local vs UTC** — `r:datetime` / `c:datetime` use local time; `r:utc_datetime` / `c:utc_datetime` use UTC and end in `Z`.
- **Ranges around now** accept combined durations such as `2s` or `1h1m`.
- **Current offsets** use a signed duration: `c:utc_datetime(+2s)`, `c:date(+7d)`.
- **Time comparison** — `=5s~` / `!5s~` check that two times differ by at most (or more than) the velocity. A duration is required; bare `=~` is the deprecated as-string operator.
- **No JS required** — tokens can be used directly in API `body`, `headers`, `query`, `cookies`, `url`, and input defaults.

## How to use

### In VS Code

1. Open any `*_test.mmt` file, or `suite.mmt` to run them all.
2. Click **Run**.
3. Inspect the response to see generated values change on each run.

### With the CLI

```sh
npx testlight run examples/intermediate/12_dynamic_values/random_types_test.mmt
npx testlight run examples/intermediate/12_dynamic_values/random_time_test.mmt
npx testlight run examples/intermediate/12_dynamic_values/current_test.mmt
npx testlight run examples/intermediate/12_dynamic_values/suite.mmt
```

## Next steps

- See [Check operators](../23_check_operators/) for a fixed-payload `=5s~` / `!5s~` example.
- See [Simple Mock Server](../18_simple_mock_server/) for random tokens in mock server responses.
- See [JavaScript Helpers](../14_javascript_helpers/) for the JavaScript `Random.*` helpers.
- See [Dynamic values](../../../docs/features/dynamic-values/index.md) for the full token list.
