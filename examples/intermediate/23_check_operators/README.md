# Check Operators

Intermediate example that exercises every comparison operator against a live echo response, using `expect` on the call plus `check` and `assert` steps.

## Files

| File | Description |
|---|---|
| `api/sample.mmt` | POST echo API with a fixed JSON body and named outputs |
| `operators_test.mmt` | Test covering numeric, string, membership, regex, length, and fuzzy operators |

## How to use

### In VS Code

1. Open `operators_test.mmt`.
2. Click **Run test** and inspect expect / check / assert results in the report panel.

### With the CLI

```sh
npx testlight run examples/intermediate/23_check_operators/operators_test.mmt
```

## Key concepts

- **`expect` on `call`** — validate outputs inline (grouped as one report item).
- **`check`** — log failures and continue.
- **`assert`** — stop the flow on failure.
- **Fuzzy operators** — `>N%` (at least N% similar) and `<N%` (less than N% similar); UI forms are `>%` / `<%` with a percent selector.
- **YAML quoting** — operators that start with `>` (including `>80%` and `>%`) must be quoted in YAML.
