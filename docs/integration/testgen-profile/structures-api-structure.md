# API structure

Required top-level keys for HTTP/WS definitions.

```yaml
type: api                    # literal
title: string                # optional but recommended
tags: string[]               # optional
description: string          # optional
import: record<string,string># optional (alias -> path)
inputs: record<string, primitive>
outputs: record<string, string>
setenv: record<string, string>
protocol: http | ws          # optional, inferred from URL
method: get|post|put|delete|patch|head|options|trace   # HTTP only
format: json | xml | xmle | text | urlencoded | { request, response }    # affects body encoding
url: string                  # may include query string
headers: record<string,string>
query: record<string,string>
cookies: record<string,string>
body: object|string|null     # type depends on format
examples: Array<{
  name: string               # required
  description?: string
  inputs?: record<string, primitive>
}>
```

Example (HTTP):
```yaml
type: api
protocol: http
method: post
url: https://test.mmt.dev/echo
body:
  name: John
```

Example (WebSocket):
```yaml
type: api
protocol: ws
url: wss://ws.example.com/chat
inputs:
  greeting: "Hello, server!"
body: i:greeting
# Response handling occurs in test (use check/assert on returned payload)
```

Notes
- Dynamic tokens: `r:<name>`, `c:<name>`, `e:<VAR>` supported in url/headers/query/cookies/body/inputs
- Default headers are auto-added; set a header value to `_` to block (User-Agent, Content-Type, Content-Length, etc.)
- For WebSocket (`protocol: ws`): Treat as synchronous req-res; `body` is the sent message, response is the reply.
- Place inputs immediately after title/description for readability
- Skip empty maps/arrays unless the generator has a reason to include placeholders (empty blocks are optional per schema)
- Inputs SHOULD NOT list data types as literal strings (e.g., `name: string`). Instead they hold default/sample primitive values or dynamic tokens. Example: `name: r:firstName`, `email: r:email`. Use examples section to override input values per example.

See also: docs/files/api/index.md
