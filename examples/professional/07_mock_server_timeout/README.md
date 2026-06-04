# Mock Server Timeout Simulation

This professional example demonstrates a request timeout against a delayed local mock server endpoint.

## Scenario

- The mock server exposes `GET /slow`.
- The endpoint has `delay: 3000`, so it waits 3 seconds before responding.
- The API request sets `timeout: 2000`, so it times out after 2 seconds.

## Files

| File | Purpose |
|---|---|
| `server/mock_server.mmt` | Defines the mock server on port `9107` with a delayed `/slow` endpoint |
| `api/slow_request.mmt` | Calls `/slow` with `timeout: 2000` |
| `test/slow_timeout_test.mmt` | Starts the mock server and calls the slow API |
| `suite.mmt` | Runs the timeout simulation as a suite |

## Run

```sh
npx testlight run examples/professional/07_mock_server_timeout/test/slow_timeout_test.mmt
```

This example is expected to fail with a request timeout because the request timeout is shorter than the mock response delay.
