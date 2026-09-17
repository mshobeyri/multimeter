# Random Values

Demonstrates built-in `r:xxx` tokens in YAML files. These tokens generate random values at runtime without needing a `js` step.

## Structure

```
12_random_values/
├── api/
│   └── random_echo.mmt          # API using random tokens in the request body
├── random_values_test.mmt       # Test that calls the API and validates the echoed values
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/random_echo.mmt` | Sends primitive, identity, network, business, text, and ranged date/time values |
| `random_values_test.mmt` | Calls the API and checks that the generated values were echoed back |

## Example tokens

```yaml
body:
  id: r:uuid
  email: r:email
  name: r:first_name
  lucky_number: r:int
  active: r:bool
  request_id: req-<<r:uuid>>
  bounded_int: r:int(10,20)
  random_float: r:float(0,1)
  short_code: r:alphanumeric(12)
  username: r:username
  domain: r:domain
  random_url: r:url
  company: r:company
  random_datetime: r:datetime(2026-01-01,2026-12-31)
  random_utc_datetime: r:utc_datetime(2026-01-01T00:00:00Z,2026-12-31T23:59:59Z)
  datetime_near_now: r:datetime_now(1h1m)
  utc_datetime_near_now: r:utc_datetime_now(1h1m)
  ranged_epoch: r:epoch(1700000000,1800000000)
```

## Key concepts

- **Standalone `r:xxx` values** keep their native type. For example, `r:int` becomes a number and `r:bool` becomes a boolean.
- **Embedded tokens** must use `<< >>`. In this example, `req-<<r:uuid>>` generates a string with a random suffix.
- **Parameterized generators** use parentheses for lengths and ranges, such as `r:int(10,20)` and `r:alphanumeric(12)`.
- **Local vs UTC** — `r:datetime` uses local time; `r:utc_datetime` uses UTC and ends in `Z`.
- **Ranges around now** accept combined durations such as `1h1m`. The generated value is within that distance before or after now.
- **No JS required** — random values can be used directly in API `body`, `headers`, `query`, `cookies`, `url`, and input defaults.
- **Inline `expect`** checks the echoed values without adding separate `assert` or `check` steps.

## How to use

### In VS Code

1. Open `random_values_test.mmt`.
2. Click **Run** to execute the test.
3. Inspect the response to see the generated values change on each run.

### With the CLI

```sh
npx testlight run examples/intermediate/12_random_values/random_values_test.mmt
```

## Next steps

- See [Simple Mock Server](../18_simple_mock_server/) for random tokens in mock server responses.
- See [JavaScript Helpers](../14_javascript_helpers/) for the JavaScript `Random.*` helpers.
- See [API docs](../../../docs/files/api/index.md) for the full list of supported random tokens.