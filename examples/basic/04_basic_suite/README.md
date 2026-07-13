# Basic Suite

A minimal `type: suite` example that runs two simple HTTP tests together.

## Files

| File | Description |
|---|---|
| `suite.mmt` | Lists the tests to run |
| `tests/get_status_test.mmt` | Simple GET test |
| `tests/post_echo_test.mmt` | Simple POST test |

## How to use

### In VS Code

1. Open `suite.mmt`.
2. Click **Run** to execute both tests.
3. The suite report shows each test result.

### With the CLI

```sh
npx testlight run examples/basic/04_basic_suite/suite.mmt
```

## Key concepts

- **`type: suite`** groups test files.
- **`items`** lists the files to run (tests, APIs, or other suites).
- Suites are useful when a workflow grows beyond one test file.

See [Suite docs](../../../docs/suite-mmt.md) for the full suite reference.
