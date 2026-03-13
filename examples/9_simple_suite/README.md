# Simple Suite

A minimal example of a `type: suite` file that runs multiple tests together.

## Structure

```
9_simple_suite/
├── api/
│   ├── echo_api.mmt       # API that echoes a posted message
│   └── status_api.mmt     # API that returns server status
├── test/
│   ├── echo_test.mmt      # Test that calls the echo API and checks the response
│   └── status_test.mmt    # Test that calls the status API and checks the status code
├── suite.mmt               # Suite that runs both tests
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/echo_api.mmt` | Posts a message and extracts the echoed value |
| `api/status_api.mmt` | Sends a GET request and extracts the status code |
| `test/echo_test.mmt` | Calls the echo API with an input and verifies it is echoed back |
| `test/status_test.mmt` | Calls the status API and verifies a 200 response |
| `suite.mmt` | Suite that runs both tests in parallel |

## How to use

### In VS Code

1. Open `suite.mmt`.
2. Click **Run** to execute the entire suite.
3. The panel shows the result of each test.

### With the CLI

```sh
npx testlight run examples/9_simple_suite/suite.mmt
```
