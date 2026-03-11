# Simple Test

A minimal example of a `type: test` file that calls an API with an input and checks the output.

## Files

| File | Description |
|---|---|
| `echo_api.mmt` | API definition — POSTs a message to the echo endpoint and extracts it from the response |
| `echo_test.mmt` | Test flow — calls the echo API, passes an input, and checks the response status and echoed message |

## How to use

### In VS Code

1. Open `echo_test.mmt`.
2. Click **Run** to execute the test.
3. The Log panel shows whether the checks passed or failed.

### With the CLI

```sh
npx testlight run examples/6_simple_test/echo_test.mmt
```

Override the input from the command line:

```sh
npx testlight run examples/6_simple_test/echo_test.mmt -e message="hi there"
```

## Key concepts

- **`import`** — brings `echo_api.mmt` into the test as `echo`.
- **`call`** — invokes the imported API. `id: result` stores its outputs for later reference.
- **`inputs`** — passes the test-level `message` input into the API call via `i:message`.
- **`check`** — inline checks on the call verify that `status_code == 200` and the echoed message matches the input. Failures are logged but don't stop the flow (use `assert` to stop on failure).

## Next steps

- See [1_simple_api_test/](../1_simple_api_test/) for standalone API examples.
- See [3_api_inputs_outputs/](../3_api_inputs_outputs/) for more input/output patterns.
- See [Test docs](../../docs/test-mmt.md) for the full test reference.
