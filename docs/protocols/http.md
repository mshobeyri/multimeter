# HTTP

Default protocol for most APIs. Inferred from the URL unless you set `protocol: http`.

### HTTP GET

```yaml
 type: api
 url: <<e:api_url>>/users   # protocol inferred as http from URL
 method: get
 timeout: 5000  # optional per-request timeout in milliseconds
 format: json   # affects default Content-Type and body handling
 headers:
   Session: e:token
 query:
   limit: "10"
   sort: desc
```

Notes:
- `format` sets how the body is encoded/decoded (defaults to `json` if omitted)
- Use a single value when request and response share a format, or split them:

```yaml
format:
  request: json
  response: xml
```

- `timeout` overrides the default request timeout for this API call, in milliseconds
- `query` merges with any query string in `url`
- `protocol` is optional — inferred from URL (`ws://` or `wss://` → ws, otherwise http)

Tip: You can use dynamic tokens anywhere in url/headers/body/query/cookies (`r:uuid`, `c:date`, `e:token`). See [Dynamic values](../files/api/dynamic-values.md).

You can also import JSON/YAML/CSV data files with a top-level `import:` map and reference values with `${alias.path}`. See [Data Imports](../integration/data-imports.md).

Side note: if you paste a `curl ...` command into an API editor, Multimeter can convert it into `type: api` YAML. For HTTP APIs, the toolbar can also run the current request in a terminal using `curl`.

POST bodies (JSON, XML, urlencoded, binary, text): [HTTP bodies](./http-bodies.md).

Next: [HTTP bodies](./http-bodies.md) · [GraphQL](./graphql.md) · [WebSocket](./websocket.md) · [gRPC](./grpc.md)
