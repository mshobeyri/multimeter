# Mock Server

Multimeter provides two ways to mock APIs:

1. **Mock Server Panel** (VS Code sidebar) — a lightweight server for quick prototyping with reflect mode and custom status codes.
2. **MMT Mock Server Files** (`type: server`) — fully-featured mock definitions in YAML with routing, matching, dynamic responses, and proxy forwarding.

Both approaches support HTTP, HTTPS, mTLS, and WebSocket.

---

## Mock Server Panel

A lightweight mock server built into Multimeter to prototype and test clients without a live backend.

Use it during development to inspect requests, echo (reflect) them back, and simulate simple responses for HTTP and WebSocket.

![Mock server](../screenshots/mock_server.png)

## What you can use it for
- Frontend/mobile prototyping before the real API is ready
- Contract checks while iterating on request/response shapes
- Offline development and demos
- Point tests or tools at a predictable local endpoint

## Supported protocols
- HTTP: receive requests on a local port and reply with a simple body/status
- HTTPS: receive secure requests on a local port; mTLS can be enabled with client certificate verification
- WebSocket: accept connections and echo frames (useful for client wiring and quick payload checks)

## Controls in the panel
- Port: the local port to listen on (e.g., 8081)
- Reflect: when enabled, the server echoes back what it receives
  - HTTP: response body includes method, path, headers, and body you sent
  - WS: incoming frames are sent back to the same client
- Status: optional response status for HTTP (for example, 200, 400, 500)
- Content type: pick a content type for the HTTP response body (json/xml/text)

Tip: Reflect is a great way to validate what your client actually sends -- no backend needed.

## Point your client or tests to it
- In your API `.mmt`, set the base URL to the mock server, for example:
  - url: http://localhost:8081
- Or use an environment variable and swap presets between real and mock:
  - variables.api_url: http://localhost:8081
  - tests and APIs reference it via `<<e:api_url>>`

When Reflect is on, you will see the same payload you sent in the response body. Turn it off and set a Status to simulate error paths.

## Request history
The mock server records each incoming request. Use the history view to inspect:
- Method, URL, headers, and body of each request
- Timestamp and order of arrival

This is useful for verifying that your client sends the correct payloads without needing an external tool.

## Notes and limits
- Designed for local development -- do not expose publicly
- State is not persisted between runs
- Response shaping is basic by design; for complex mocking, use an external tool and keep Multimeter for authoring/running tests

---

## HTTPS and mTLS

The Mock Server panel can run an HTTPS server on localhost.

- Set **Server Type** to **HTTPS**.
- Optionally select a **server certificate** file (PEM/CRT) and matching **server key** file (PEM/KEY). If no cert/key is provided for TLS mode in a `.mmt` mock server file, Multimeter uses built-in self-signed certs.

### mTLS (client certificate verification)

To require clients to present a valid certificate (mutual TLS):

- Set **Server Type** to **HTTPS** and enable **Require client certificate (mTLS)**.
- Select a **Client CA** file (PEM) that signed the client certificates you want to accept.

When mTLS is enabled:
- The server will request a client certificate from connecting clients.
- Clients without a valid certificate signed by the configured CA will be rejected.

### Testing TLS and mTLS with curl

**TLS only (server cert, no client cert):**
```sh
curl --cacert certs-test/ca.crt https://127.0.0.1:8080/
```

**mTLS (client cert required):**
```sh
curl --cacert certs-test/ca.crt \
     --cert certs-test/client.crt \
     --key certs-test/client.key \
     https://127.0.0.1:8080/
```

### Notes
- The server binds to `127.0.0.1`.
- Certificate file paths are stored in VS Code workspace state and persist across restarts.
- Only PEM format is supported (`.pem`, `.crt`, `.cer`, `.key`).
- Most HTTP clients will need to trust the server certificate (add the CA to `certificates.server_ca` or disable validation where appropriate).

---

## MMT Mock Server Files

In addition to the basic mock server modes (HTTP, HTTPS, mTLS, WebSocket), you can define fully-featured mock servers in `.mmt` files with `type: server`. These files support:

- Multiple endpoints with different paths and methods
- Request matching (body, headers, query parameters)
- Path parameters (e.g., `/users/:id`)
- Dynamic response values (`r:uuid`, `c:date`, `e:VAR`)
- Response delays and global headers
- Proxy forwarding for unmatched routes
- Fallback responses

### Server file example

```yaml
type: server
title: User Service Mock
protocol: http
port: 8081
cors: true

endpoints:
  - method: get
    path: /health
    status: 200
    body: OK

  - method: get
    path: /users/:id
    status: 200
    format: json
    body:
      id: ":id"
      name: Test User
      created: c:date

  - method: post
    path: /users
    status: 201
    format: json
    body:
      id: r:uuid
      message: User created

fallback:
  status: 404
  body:
    error: Not Found
```

### HTTPS and mTLS server files

Mock server file protocols are `http`, `https`, or `ws`. The `connection` block controls whether the HTTP connection is plain, TLS, or mTLS:

```yaml
type: server
protocol: https
port: 8443
connection:
  mode: tls
  cert: ./certs/server.crt
  key: ./certs/server.key
endpoints:
  - method: get
    path: /health
    status: 200
    body: OK
```

For mTLS, `connection.client_ca` is required:

```yaml
type: server
protocol: https
port: 8444
connection:
  mode: mtls
  cert: ./certs/server.crt
  key: ./certs/server.key
  client_ca: ./certs/ca.crt
endpoints:
  - method: get
    path: /secure
    status: 200
    body: OK
```

### Running from the Mock Server panel

1. Set **Server Type** to **MMT Mock Server**
2. Click the folder button and select your `.mmt` server file
3. Optionally adjust the port (overrides the file's default)
4. Click **Run Mock Server**

The server starts with full routing — requests are matched against your endpoints, and responses use all the dynamic token features of Multimeter.

---

## Using Mock Servers in Tests

You can start mock servers directly from your tests using the `run` step. This makes tests self-contained — no need to manually start servers before running.

### Import and run

```yaml
type: test
title: Test with Mock Server
import:
  mockApi: ./mocks/user-service.mmt
  userApi: ./apis/user.mmt
steps:
  - run: mockApi                # starts the mock server
  - call: userApi
    id: getUsers
  - assert: ${getUsers.status} == 200
```

### Behavior

- If the server is already running, `run` does nothing (idempotent)
- All servers started by `run` stop automatically when the test finishes
- If the port is already in use by another process, the test fails with an error

### Adding a server step in the UI

In the Flow panel, click **Add item** and select **Server**. A box appears where you can choose from your imported server files.

---

## Using Mock Servers in Suites

Use the top-level `servers:` field to list mock server files that should start **before** any tests and remain running for the entire suite duration. They are stopped automatically when the suite finishes.

### Example

```yaml
type: suite
title: Integration Suite
servers:
  - mocks/user-service.mmt
  - mocks/auth-service.mmt
tests:
  - tests/login.mmt
  - tests/profile.mmt
```

### Execution flow

1. All files listed under `servers:` start before any tests
2. Tests begin once servers are ready
3. When the suite finishes, all servers are stopped automatically

You can also include `type: server` files directly in the `tests` array for inline control over when they start relative to other stages.

This lets you set up complex integration environments declaratively, without manual server management.

---

## See also
- [API](./api-mmt.md) — point API URLs at the mock server
- [Test](./test-mmt.md) — use `run` step to start mock servers in tests
- [Suite](./suite-mmt.md) — include `type: server` files in suite execution
- [Environment](./environment-mmt.md) — swap between real and mock URLs with presets
- [Certificates](./certificates-mmt.md) — configure TLS certificates for secure mock clients
- [Reports](./reports.md) — generate test reports from runs that use mocks
- [Testlight CLI](./testlight.md) — run tests and suites (including mock servers) from the command line
- [Sample Project](./sample-project.md) — full walkthrough of a Multimeter project
