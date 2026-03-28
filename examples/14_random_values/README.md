# Random Values

Demonstrates built-in `r:xxx` tokens in YAML files. These tokens generate random values at runtime without needing a `js` step.

## Structure

```
14_random_values/
├── api/
│   └── random_echo.mmt          # API using random tokens in the request body
├── random_values_test.mmt       # Test that calls the API and validates the echoed values
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/random_echo.mmt` | Sends random UUID, email, first name, integer, and boolean values |
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
```

## Key concepts

- **Standalone `r:xxx` values** keep their native type. For example, `r:int` becomes a number and `r:bool` becomes a boolean.
- **Embedded tokens** must use `<< >>`. In this example, `req-<<r:uuid>>` generates a string with a random suffix.
- **No JS required** — random values can be used directly in API `body`, `headers`, `query`, `cookies`, `url`, and input defaults.
- **Inline `expect`** checks the echoed values without adding separate `assert` or `check` steps.

## How to use

### In VS Code

1. Open `random_values_test.mmt`.
2. Click **Run** to execute the test.
3. Inspect the response to see the generated values change on each run.

### With the CLI

```sh
npx testlight run examples/14_random_values/random_values_test.mmt
```

## Next steps

- See [10_simple_mock_server/](../10_simple_mock_server/) for random tokens in mock server responses.
- See [16_javascript_helpers/](../16_javascript_helpers/) for the JavaScript `Random.*` helpers.
- See [API docs](../../docs/api-mmt.md) for the full list of supported random tokens.