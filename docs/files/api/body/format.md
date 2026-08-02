# Format

`format` controls how Multimeter encodes the request body and decodes the response body.

- Values: `json` | `xml` | `xmle` | `text` | `urlencoded` | `binary`
- Optional — defaults to `json`
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

| Format | Typical use |
|---|---|
| `json` | JSON APIs (default) |
| `xml` | XML with self-closing empty tags (`<meta/>`) |
| `xmle` | Expanded XML with explicit closing tags (`<meta></meta>`) |
| `text` | Raw text body |
| `urlencoded` | Form fields as `application/x-www-form-urlencoded` |
| `binary` | File path relative to the `.mmt` file |

The `body` field shape depends on `format`. See [Request body](./body.md) and [HTTP bodies](../protocols/http-bodies.md).

Not used with GraphQL (`format` is always JSON) or gRPC (the `grpc` block replaces `body` and `format`).

See also: [Body overview](./index.md) · [Request fields](../index.md#request) · [HTTP](../protocols/http.md)
