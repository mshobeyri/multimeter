# Server tokens

Echo request data and inject dynamic values in `type: server` responses. See [Mock server files](./files.md) for the overall file shape.

### Echoing request data

Use `${namespace.field}` placeholders in response `body` values (and inside strings):

| Namespace | Syntax | Source |
|-----------|--------|--------|
| URL | `${url.id}` | Path parameters from route patterns like `/users/:id` |
| URL | `${url.path}` | Full request path (without query string) |
| Body | `${body.name}` | Parsed request body (JSON or XML → object) |
| Header | `${header.authorization}` | Incoming request headers (case-insensitive) |
| Query | `${query.page}` | Query string parameters |

```yaml
body:
  id: "${url.id}"
  received_name: "${body.name}"
  client_key: "${header.x-api-key}"
  page: "${query.page}"
  message: "Created user ${body.name} with id ${url.id}"
```

Request bodies are parsed automatically from JSON or XML. Nested fields use dot notation: `${body.user.email}`.

In the YAML editor, type `${` to get autocomplete for `url.`, `body.`, `header.`, and `query.` — including path parameter names from your endpoint paths.

### Environment, random, and current tokens

Mock responses use the same dynamic tokens as APIs and tests. Values are resolved when the mock handles a request, using the active environment (VS Code Environment panel, suite `environment`, or CLI `--env-file` / `-e`):

| Token | Example | Description |
|-------|---------|-------------|
| `e:VAR` / `<<e:VAR>>` | `email: e:ADMIN_EMAIL` | Environment variable |
| `r:name` | `id: r:uuid` | Random value (new per request) |
| `c:name` | `created: c:date` | Current date/time |

`e:` tokens also work in response headers, `match` rules, path patterns, `port`, and `protocol`:

```yaml
type: server
protocol: e:MOCK_PROTOCOL
port: e:MOCK_PORT
endpoints:
  - method: get
    path: <<e:BASE_PATH>>/users
    match:
      headers:
        x-api-key: e:API_KEY
    status: 200
    headers:
      X-Mock-Env: e:ENV_NAME
    body:
      email: e:ADMIN_EMAIL
      greeting: "Hello from <<e:ENV_NAME>>"
```

Set `MOCK_PORT` / `MOCK_PROTOCOL` (and other vars) in the Environment panel, a suite `environment`, or via CLI `--env-file` / `-e`.

While typing an incomplete token such as `protocol: e:`, YAML may temporarily parse it as a nested map — Multimeter treats that as a validation error instead of crashing the editor.

See also: [Server files](./files.md) · [Dynamic values](../../features/dynamic-values.md) · [Environment](../env.md)
