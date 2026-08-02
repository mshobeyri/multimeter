# Mock server panel

Open the **Multimeter** activity bar and choose **Mock Server** ({{btn:server:Mock Server}}). This sidebar panel is a lightweight local server for quick prototyping — reflect mode, custom status codes, and optional loading of a `type: server` file.

For full mock definitions in YAML (routing, matching, dynamic responses), use [Mock Server files](./index.md) instead.

## What you can use it for

- Frontend/mobile prototyping before the real API is ready
- Contract checks while iterating on request/response shapes
- Offline development and demos
- Point tests or tools at a predictable local endpoint

## Supported protocols

| Server type | What it does |
|---|---|
| **HTTP** | Receive requests on a local port and reply with a simple body/status |
| **HTTPS** | Secure HTTP on localhost; optional mTLS — see [TLS below](#https-and-mtls) |
| **WebSocket** | Accept connections and echo frames |
| **MMT Mock Server** | Load a `type: server` file for full routing — see [Run a server file](#run-a-server-file) |

## Controls

| Control | What it does |
|---|---|
| **Port** | Local port to listen on (e.g. 8081) |
| **Reflect** | Echo back what the client sends (HTTP body includes method, path, headers, and body; WS frames echo to the same client) |
| **Status** | Optional HTTP response status (e.g. 200, 400, 500) when Reflect is off |
| **Content type** | Response body format: json, xml, xmle, text, or urlencoded |

Tip: Reflect is a great way to validate what your client actually sends — no backend needed.

## Point your client or tests

- In an API `.mmt`, set the base URL to the mock server: `url: http://localhost:8081`
- Or use an environment variable and swap presets between real and mock:
  - `variables.api_url: http://localhost:8081`
  - Tests and APIs reference it via `<<e:api_url>>`

When Reflect is on, the response body includes the payload you sent. Turn Reflect off and set a Status to simulate error paths.

## Request history

The panel records each incoming request. Inspect method, URL, headers, body, and arrival order in the history view. See also: [History](../../features/history.md).

## Run a server file

1. Set **Server Type** to **MMT Mock Server**
2. Click the folder button and select your `.mmt` server file
3. Optionally adjust the port (overrides the file default)
4. Click **Run Mock Server**

The server starts with full routing — requests match your endpoints and responses use Multimeter dynamic tokens. See [Edit Mock](./edit.md) and [Endpoints](./endpoints.md).

## HTTPS and mTLS

The panel can run HTTPS on localhost (`127.0.0.1`).

- Set **Server Type** to **HTTPS**
- Optionally select a **server certificate** (PEM/CRT) and **server key** (PEM/KEY)

For mTLS (client certificate verification):

- Enable **Require client certificate (mTLS)**
- Select a **Client CA** file (PEM) that signed the client certificates you accept

When mTLS is enabled, clients without a valid certificate signed by the configured CA are rejected.

**TLS only:**
```sh
curl --cacert certs-test/ca.crt https://127.0.0.1:8080/
```

**mTLS:**
```sh
curl --cacert certs-test/ca.crt \
     --cert certs-test/client.crt \
     --key certs-test/client.key \
     https://127.0.0.1:8080/
```

Certificate paths are stored in VS Code workspace state. Only PEM format is supported (`.pem`, `.crt`, `.cer`, `.key`). For TLS in `type: server` files (paths relative to the file), see [TLS](./tls.md).

## Notes and limits

- Designed for local development — do not expose publicly
- State is not persisted between runs
- Response shaping is basic; for complex mocking, use [server files](./index.md)

---

See also: [Mock Server overview](./index.md) · [Quick start](./quick-start.md) · [CLI](./cli.md)
