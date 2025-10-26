# API

Usage-first guide to write APIs in `.mmt` files. Includes HTTP/WS, params, bodies, env, reuse, and a compact reference at the end.

Supported:
- Protocols: `http`, `ws`
- Formats: `json`, `xml`, `text`
- Methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`

---

## Quick start

### HTTP GET
```yaml
 type: api
 protocol: http
 format: json   # affects default Content-Type and body handling
 method: get
 url: <<e:API_URL>>/users
 headers:
   Session: e:TOKEN
 query:
   limit: "10"
   sort: desc
```
Notes
- `format` sets how the body is encoded/decoded
- `query` merges with any query string in `url`

### HTTP POST JSON or XML
```yaml
 type: api
 protocol: http
 format: json
 method: post
 url: <<e:API_URL>>/login
 headers:
   X-App: multimeter
 body:
   username: e:USER
   password: e:PASS
```

Change `format` to `xml` to send an XML body instead of JSON.

### HTTP raw text or raw XML
```yaml
# text
 type: api
 protocol: http
 format: text
 method: post
 url: <<e:API_URL>>/echo
 body: |
   hello world

# xml
 type: api
 protocol: http
 format: xml
 method: post
 url: <<e:API_URL>>/xml
 body: |
   <root>
    <value>42</value>
  </root>
```

### WebSocket
```yaml
 type: api
 protocol: ws
 format: json
 url: ws://localhost:8080/ws
 headers:
   X-Auth: e:TOKEN
 # drive messages in tests via call steps
```
Tip: For WS, use tests to send/receive frames with `call` steps that invoke this API.

---

## API elements
Items in the `api` type fall into a few sections:
- Documentation: fields that help search, filter, and auto-document APIs
- Request: the request/message you’ll send
- Reuse and compose: inputs/outputs/extract/setenv for reuse
- Examples: sample inputs you can run as smoke tests

The next sections cover each category in detail.

## Documentation
The following fields make it easy to search, filter, and auto‑document APIs:
- title: API title
- tags: related tags
- description: short explanation of the API

Sample:
```yaml
type: api
title: generate session
description: create a session from username and password.
tags:
  - smoke
  - authentication
```

## Request
- protocol: `http` or `ws`
- method: HTTP method `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`
- format: body format `json` | `xml` | `text`
- url: server URL
- headers: HTTP headers
- query: query parameters for HTTP requests
- cookies: HTTP cookies
- body: request body (HTTP) or message (WS)

As noted in the quick start, the body can be raw XML, JSON, or text. It can also be a YAML object that’s automatically converted to the specified format.


Sample:
```yaml
protocol: http
method: get
url: x.com/blog
headers:
  Authorization: Bearer <<e:TOKEN>>
  Accept: application/json
query:
  limit: "20"
  page: "1"
  # will be converted to x.com/blog?limit=20&page=1
cookies:
  session: e:SESSION_ID
```

## Reuse and compose
These fields help you call an API with different inputs and capture outputs.

### inputs
Declare inputs and reference them with `<<i:key>>` in URL, headers, or body. This lets you reuse the API with different values across tests. Tests have the same structure to chain calls.
You can also write `i:name` if it doesn’t conflict with surrounding text. When embedded in other text (like inside a URL), use `<<i:name>>`.
```yaml
 type: api
 title: Get user by ID
 inputs:
   userId: string
 protocol: http
 format: json
 method: get
 url: <<e:API_URL>>/users/<<i:userId>>
```

Notes
- `<<i:key>>` can appear inside `url`, `headers`, and `body`
- Declare input names under `inputs:` (string/number/boolean/null)

### extract
Pull fields from the response to populate outputs. Use one of the following per key:
- A regex applied to the raw response body text: `regex ...`
- A bracket path starting with `body[...]` to read structured fields (you can also use `headers[...]` or `cookies[...]`)

Example
```yaml
extract:
  name: regex message(.*)
  from: body[from][0]
  method: body[method]
```

### outputs
Describe the shape/type of values this API exposes for downstream consumers.
```yaml
outputs:
  id: string
  status: number
  name: string
```
Tip: Pair `extract` with `outputs` so tests can reference `<stepId>.<key>` with confidence.

### setenv
Promote values (often from `extract`) into the runtime environment.
```yaml
setenv:
  TOKEN: body[token]
  USERNAME: e:USER
```
These become available to subsequent steps/tests as environment variables.

## Examples
Define example inputs so you can run them as smoke tests. When examples exist, the Tests panel shows a dropdown; picking one pre‑fills the inputs.

```yaml
examples:
  - name: happy-path
    description: Login with valid user
    inputs:
      username: alice
      password: secret
  - name: invalid-pass
    inputs:
      username: alice
      password: wrong
```

## Validation and requirements
- For `protocol: http`, `method` is required
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)

---

## Complete examples

### HTTP
```yaml
 type: api
 title: Search users
 tags:
   - user
   - search
 description: Full-text search on users
 protocol: http
 format: json
 method: get
 url: <<e:API_URL>>/users/search
 headers:
   Authorization: Bearer <<e:TOKEN>>
   X-Client: test
 query:
   q: john
   limit: "10"
 cookies:
   locale: en-US
 extract:
  total: body[total]
 setenv:
  LAST_TOTAL: body[total]
 outputs:
   total: number
```

### WS
```yaml
 type: api
 title: Notifications stream
 protocol: ws
 format: json
 url: wss://example.com/ws
 headers:
   X-Auth: e:TOKEN
 # Drive messages in a test using steps
```

---

## Reference (types)
- type: `api`
- title: string
- tags: string[]
- description: string
- import: record<string, string>
- inputs: record<string, string | number | boolean | null>
- outputs: record<string, string | number | boolean | null>
- extract: record<string, string>
- setenv: record<string, string>
- protocol: `http` or `ws`
- method: HTTP verbs (HTTP only)
- format: `json` | `xml` | `text`
- url: string (can contain query string)
- headers: record<string, string>
- query: record<string, string>
- cookies: record<string, string>
- body: string or object (json/xml/text based on format)
- examples: array of { name (required), description?, inputs? }
