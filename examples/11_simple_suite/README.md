# Simple Suite

A minimal example of `type: suite` files that run multiple tests together, demonstrating both **parallel** and **sequential** execution modes.

## Structure

```
9_simple_suite/
├── api/
│   ├── echo_api.mmt            # API that echoes a posted message
│   └── status_api.mmt          # API that returns server status
├── test/
│   ├── echo_test.mmt           # Test that calls the echo API and checks the response
│   ├── echo_test_fail.mmt      # Test that calls the echo API and expects a failure
│   ├── status_test.mmt         # Test that calls the status API and checks the status code
│   └── status_test_fail.mmt    # Test that calls the status API and expects a failure
├── suite_parallel.mmt           # Suite that runs all tests in parallel
├── suite_sequential.mmt         # Suite that runs all tests one after another
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/echo_api.mmt` | Posts a message and extracts the echoed value |
| `api/status_api.mmt` | Sends a GET request and extracts the status code |
| `test/echo_test.mmt` | Calls the echo API with an input and verifies it is echoed back |
| `test/echo_test_fail.mmt` | Calls the echo API and expects the assertion to fail |
| `test/status_test.mmt` | Calls the status API and verifies a 200 response |
| `test/status_test_fail.mmt` | Calls the status API and expects the assertion to fail |
| `suite_parallel.mmt` | Suite that runs all four tests in parallel (default behavior) |
| `suite_sequential.mmt` | Suite that runs all four tests sequentially using `then` separators |

## Parallel vs Sequential

- **Parallel** (`suite_parallel.mmt`): all tests are listed directly under `tests` and execute at the same time.
- **Sequential** (`suite_sequential.mmt`): tests are separated by `- then` entries, so each test waits for the previous one to finish before starting.

## How to use

### In VS Code

1. Open `suite_parallel.mmt` or `suite_sequential.mmt`.
2. Click **Run** to execute the suite.
3. The panel shows the result of each test.

### With the CLI

```sh
# Run tests in parallel
npx testlight run examples/11_simple_suite/suite_parallel.mmt

# Run tests sequentially
npx testlight run examples/11_simple_suite/suite_sequential.mmt
```
