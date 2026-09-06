# Endpoints

Define mock behavior in `type: server` YAML. The visual editor exposes these fields in the **Server** and **Endpoints** tabs — see [Edit Mock](./edit.md).

## Server settings

| Field | Description |
|---|---|
| `protocol` | `http`, `https`, or `ws` |
| `port` | Local listen port |
| `cors` | Enable CORS headers |
| `delay` | Global response delay (ms) |
| `connection` | TLS/mTLS settings — see [TLS](./tls.md) |
| `proxy` | Forward unmatched requests to a real backend |
| `fallback` | Default response when no endpoint matches |

## Endpoint blocks

Each entry under `endpoints:` supports method, path, name, match rules, status, response body/format, headers, tags, and **reflect** mode (echo the request back).

Use `match:` to pick among several endpoints with the same method and path. Filtered endpoints win over a bare catch-all (even if the catch-all is listed first).

`match.body` / `match.query` accept nested maps or **dotted paths**, and values use the same [operators as check/expect](../test/steps/check.md#operators) (`!=`, `=C`, `=*`, …). Extra request fields are ignored. `match.headers` is the same for values (names are case-insensitive).

YAML-unsafe prefixes such as `!=` / `!C` / `>` may be written unquoted under `match:` — Multimeter quotes them before parsing (same as `expect:`).

### Example

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
      id: "${url.id}"
      name: Test User
      created: c:date

  - method: post
    path: /users
    match:
      body:
        role: admin
        profile.name: "=C Ada"
      headers:
        authorization: "=C Bearer"
    status: 201
    format: json
    body:
      id: r:uuid
      role: admin
      name: "${body.name}"

  - method: post
    path: /users
    match:
      body:
        role: "!= admin"
    status: 201
    format: json
    body:
      id: r:uuid
      name: "${body.name}"
      email: "${body.email}"
      message: User created

fallback:
  status: 404
  body:
    error: Not Found
```

Echo placeholders and dynamic tokens are documented in [Tokens](./tokens.md).

---

See also: [Mock Server overview](./index.md) · [In tests](./in-tests.md) · [In suites](./in-suites.md)
