# Simple Test

A minimal example of a `type: test` file that calls an API with an input and checks the output.

## Files

| File | Description |
|---|---|
| `echo_api.mmt` | API definition using **bracket notation** — `body[body][message]` |
| `echo_api_dot.mmt` | API definition using **dot notation** — `body.body.message` |
| `echo_test.mmt` | Test flow — calls the echo API, passes an input, and checks the response status and echoed message |

## Dot notation vs bracket notation

Both notations extract fields from the response. **Dot notation is preferred** because it is shorter and easier to read:

```yaml
# Dot notation (preferred)
outputs:
  echoed_message: body.body.message
  request_method: body.method

# Bracket notation
outputs:
  echoed_message: body[body][message]
  request_method: body[method]
```

Use **bracket notation** when a key contains a dot (e.g. `body[my.key.name]`), since dot notation would interpret the dots as path separators.

## How to use

### In VS Code

1. Open `echo_test.mmt`.
2. Click **Run** to execute the test.
3. The Log panel shows whether the checks passed or failed.

### With the CLI

```sh
npx testlight run examples/8_simple_test/echo_test.mmt
```

Override the input from the command line:

```sh
npx testlight run examples/8_simple_test/echo_test.mmt -e message="hi there"
```

## Key concepts

- **`import`** — brings `echo_api.mmt` into the test as `echo`.
- **`call`** — invokes the imported API. `id: result` stores its outputs for later reference.
- **`inputs`** — passes the test-level `message` input into the API call via `i:message`.
- **`check`** — inline checks on the call verify that `_.status == 200` and the echoed message matches the input. Failures are logged but don't stop the flow (use `assert` to stop on failure).

## Next steps

- See [1_simple_api_test/](../1_simple_api_test/) for standalone API examples.
- See [3_api_inputs_outputs/](../3_api_inputs_outputs/) for more input/output patterns.
- See [Test docs](../../docs/test-mmt.md) for the full test reference.
