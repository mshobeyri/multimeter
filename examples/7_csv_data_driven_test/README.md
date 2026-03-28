# CSV Data-Driven Test

Run the same API call for every row in a CSV file and check the results. This is useful for parameterized testing — define your test data in a spreadsheet-friendly format and let the test loop through it.

## Files

| File | Description |
|---|---|
| `echo_api.mmt` | API definition — POSTs a message to the echo endpoint and extracts the response |
| `messages.csv` | CSV data file with `message` and `expected_method` columns |
| `echo_csv_test.mmt` | Test — imports the CSV, loops over each row, calls the API, and checks the outputs |

## How to use

### In VS Code

1. Open `echo_csv_test.mmt`.
2. Click **Run** to execute the test.
3. The Log panel shows a check result for every row in the CSV.

### With the CLI

```sh
npx testlight run examples/7_csv_data_driven_test/echo_csv_test.mmt
```

## How it works

### 1. Define your test data in a CSV

```csv
message,expected_method
hello world,POST
goodbye,POST
test 123,POST
```

- The first row is the header — each column becomes a field name on the row object.
- Unquoted numbers are auto-coerced (`"42"` → `42`); `true`/`false` become booleans.
- Quoted values stay as strings (e.g. `"00123"` stays `"00123"`).

### 2. Import the CSV and bind it with `data`

```yaml
import:
  messages: messages.csv
steps:
  - for: message of messages
```

The `data` step binds the imported CSV alias into scope so it can be used in loops and expressions.

### 3. Loop with `for`

```yaml
  - for: const row of messages
    steps:
      - call: echo
        inputs:
          message: ${row.message}
        check:
          - echoed_message == ${row.message}
```

The `for` expression is standard JavaScript — `const row of messages` iterates over each CSV row. Inside the loop, wrap runtime variables in `${...}` — both in inputs (`message: ${row.column_name}`) and in checks (`output == ${row.column_name}`). This is because values are evaluated as JavaScript template literals, and `${...}` triggers interpolation.

## Key concepts

- **`import`** — imports both `.mmt` files and `.csv` files by alias.
- **`data`** — binds an imported CSV into the runtime scope for iteration.
- **`for`** — iterates using any valid JS expression. `const row of messages` loops over CSV rows.
- **`check`** — inline checks that compare API outputs against values from the current CSV row.

## Next steps

- See [6_simple_test/](../6_simple_test/) for a basic test without CSV.
- See [3_api_inputs_outputs/](../3_api_inputs_outputs/) for more input/output patterns.
- See [Test docs](../../docs/test-mmt.md#for-repeat) for the full `for`/`repeat` reference.
- See [Test docs](../../docs/test-mmt.md#data) for more on the `data` step.
