# Simple Test

A minimal `type: test` file that calls HTTP directly and checks the response. It avoids inputs, outputs, imports, and API abstraction so the first test example stays easy to read.

## Files

| File | Description |
|---|---|
| `echo_test.mmt` | Sends a POST request to the public echo endpoint and verifies the response |

## How to use

### In VS Code

1. Open `echo_test.mmt`.
2. Click **Run** to execute the test.
3. The Log panel shows whether the check passed or failed.

### With the CLI

```sh
npx testlight run examples/basic/02_simple_test/echo_test.mmt
```

## Key concepts

- **`type: test`** declares a runnable test flow.
- **`http`** calls an endpoint directly from a test step.
- **`expect`** checks response fields and reports failures.

## Next steps

- See [Simple API](../01_simple_api/) for standalone API files.
- See [API Inputs & Outputs](../../intermediate/01_api_inputs_outputs/) when you are ready for inputs, outputs, and reusable API definitions.
- See [Test docs](../../../docs/files/test.md) for the full test reference.
