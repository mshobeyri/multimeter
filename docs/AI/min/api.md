# Generate `type: api` (min)

```yaml
type: api
title: Login
method: post
url: <<e:api_url>>/login
format: json
inputs:
  username: i:username
  password: i:password
body:
  username: i:username
  password: i:password
outputs:
  token: body.token
```

## Essentials

- First line: `type: api`
- `url` required; `method` required for HTTP
- `protocol`: `http` or `ws` (often inferred)
- `format`: `json` | `text` | `xml` | `urlencoded` | …
- Optional: `headers`, `query`, `cookies`, `examples`, `setenv`
- Tokens: `e:`, `i:`, `r:`, `c:`

For tests against this API use `scaffold_test` / `api_card`, not a full OpenAPI dump.
Request `pack: full` for WS, GraphQL, gRPC, and rare fields.
