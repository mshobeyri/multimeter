# HTTP

Default protocol for most APIs. Inferred from the URL unless you set `protocol: http`.

### HTTP GET

```yaml
type: api
url: https://test.mmt.dev/json   # protocol inferred as http from URL
method: get
timeout: 5000  # optional per-request timeout in milliseconds
format: json
query:
  limit: "10"
  sort: desc
```

Notes:
- `format` and `body`: [Format](../body/format.md) · [Request body](../body/body.md)
- `timeout` overrides the default request timeout for this API call, in milliseconds
- `query` merges with any query string in `url`
- `protocol` is optional — inferred from URL (`ws://` or `wss://` → ws, otherwise http)

Tip: You can use dynamic tokens anywhere in url/headers/body/query/cookies (`r:uuid`, `c:date`, `e:token`). See [Dynamic values](../../../features/dynamic-values.md).

You can also import JSON/YAML/CSV data files with a top-level `import:` map and reference values with `${alias.path}`. See [Data imports](../../features/data-imports.md).

### HTTPS (TLS / mTLS)

Use `https://` in `url` as usual — no extra fields on the API file.

Client certificates, mTLS, and custom CA trust are configured in your environment file's **certificates** section, not in the API YAML. See [Certificates](../../../features/certificates/index.md).

POST bodies (JSON, XML, urlencoded, binary, text): [HTTP bodies](./http-bodies.md).

Next: [HTTP bodies](./http-bodies.md) · [GraphQL](./graphql.md) · [WebSocket](./websocket.md) · [gRPC](./grpc.md)

See also: [Connections panel](../../../panels/connections.md) — live HTTP keep-alive sockets
