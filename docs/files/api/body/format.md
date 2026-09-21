# Format

`format` controls how Multimeter encodes the request body and decodes the response body.

- Values: `none` | `json` | `xml` | `xmle` | `text` | `html` | `urlencoded` | `binary` | `multipart` | `auto`
- Optional — request and response both default to `auto` when omitted
- Explicit `format: json` still pins both sides to json
- Affects default `Content-Type` and body handling

Use a single value when request and response share a `format:`

```yaml
format: json
```

Split request and response when they differ:

```yaml
format:
  request: json
  response: xml
```

**Request `auto`** (default when omitted) uses the request `Content-Type` header; when that header is missing, Multimeter assumes `json`.

**Response `auto`** (default when omitted) uses the response `Content-Type` header; when that header is missing, Multimeter falls back to the resolved request format, then body sniffing — similar to Postman’s **Auto** response view.

| Format | Typical use |
|---|---|
| `none` | No request body (Postman **none**) |
| `json` | JSON APIs (default) |
| `xml` | XML with self-closing empty tags (`<meta/>`) |
| `xmle` | Expanded XML with explicit closing tags (`<meta></meta>`) |
| `text` | Raw text body |
| `html` | Raw HTML body (highlighting + `text/html`) |
| `urlencoded` | Form fields as `application/x-www-form-urlencoded` |
| `binary` | File path relative to the `.mmt` file |
| `multipart` | Form parts (`name` + text `value` or relative `file` path); Postman **form-data** (`multipart/form-data`) |

The `body` field shape depends on `format`. See [Request body](./body.md) and [HTTP bodies](../protocols/http-bodies.md).

Not used with GraphQL (`format` is always JSON) or gRPC (the `grpc` block replaces `body` and `format`).

See also: [Body overview](./index.md) · [Request fields](../index.md#request) · [HTTP](../protocols/http.md)
