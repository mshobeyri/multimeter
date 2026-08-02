# Mock server files

In addition to the basic mock server modes (HTTP, HTTPS, mTLS, WebSocket), you can define fully-featured mock servers in `.mmt` files with `type: server`. These files support:

- Multiple endpoints with different paths and methods
- Request matching (body, headers, query parameters)
- Path parameters (e.g., `/users/:id`) — echo with `${url.id}` in response values
- Request body, header, and query echo via `${body.field}`, `${header.name}`, `${query.param}`
- Dynamic response values (`r:uuid`, `c:date`, `e:var`)
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
      id: "${url.id}"
      name: Test User
      created: c:date

  - method: post
    path: /users
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

Echo placeholders and `e:` / `r:` / `c:` tokens are documented in [Server tokens](./tokens.md).

Next: [Tokens](./tokens.md) · [TLS for files](./tls-files.md) · [In tests](./in-tests.md) · [In suites](./in-suites.md)
