# Simple Mock Server

A self-contained example that defines a mock server in an `.mmt` file and runs tests against it — covering **GET** and **POST** requests with and without parameters.

## Structure

```
10_simple_mock_server/
├── server/
│   └── mock_server.mmt          # Mock server definition (type: server)
├── api/
│   ├── get_health.mmt           # GET /health — no parameters
│   ├── get_user.mmt             # GET /users/:id — path parameter
│   ├── create_user.mmt          # POST /users — JSON body
│   └── search.mmt               # GET /search?q=... — query parameter
├── test/
│   ├── health_test.mmt          # Test the health endpoint
│   ├── user_test.mmt            # Test GET and POST user endpoints
│   └── search_test.mmt          # Test the search endpoint
├── suite.mmt                    # Suite that starts the server and runs all tests
└── README.md
```

## Files

### Server

| File | Description |
|---|---|
| `server/mock_server.mmt` | Defines a mock server on port 9099 with HTTP endpoints |

### APIs

| File | Method | Path | Parameters |
|---|---|---|---|
| `api/get_health.mmt` | GET | `/health` | None |
| `api/get_user.mmt` | GET | `/users/:id` | Path param `user_id` |
| `api/create_user.mmt` | POST | `/users` | JSON body (`name`, `email`) |
| `api/search.mmt` | GET | `/search?q=...` | Query param `q` |

### Tests

| File | Description |
|---|---|
| `test/health_test.mmt` | Starts the server, calls GET `/health`, asserts `status == ok` |
| `test/user_test.mmt` | Starts the server, fetches a user by ID, creates a user via POST, asserts fields |
| `test/search_test.mmt` | Starts the server, calls GET `/search` with a query param, asserts response |

### Suite

| File | Description |
|---|---|
| `suite.mmt` | Uses `servers:` to start the mock server, then runs all three tests in parallel |

## Key concepts

- **`type: server`** — defines a mock server with endpoints, a port, and optional fallback/CORS/delay settings.
- **`run` step in tests** — starts the mock server before making API calls. If the server is already running, `run` is a no-op.
- **Path parameters** — use `:param` in server endpoint paths (e.g. `/users/:id`); reference them in the response body with `":id"`.
- **Dynamic tokens** — `r:uuid` generates a random UUID, `c:date` inserts the current date.
- **Fallback** — any request that doesn't match an endpoint returns the fallback response (404 in this example).

## How to use

### In VS Code

1. Open any test file (e.g. `test/health_test.mmt`) and click **Run**.
   The test starts the mock server automatically via the `run` step, calls the API, and checks the result.
2. Or open `suite.mmt` and click **Run** to execute all tests at once.

### With the CLI

Run individual tests:

```sh
npx testlight run examples/12_simple_mock_server/test/health_test.mmt
npx testlight run examples/12_simple_mock_server/test/user_test.mmt
npx testlight run examples/12_simple_mock_server/test/search_test.mmt
```

Run the full suite:

```sh
npx testlight run examples/12_simple_mock_server/suite.mmt
```

Override inputs:

```sh
npx testlight run examples/12_simple_mock_server/test/user_test.mmt -e user_id=99
```
