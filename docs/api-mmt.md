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

Tip: You can use dynamic tokens anywhere in url/headers/body/query/cookies.
- Random: `r:<name>` (e.g., `r:uuid`, `r:int`)
- Current: `c:<name>` (e.g., `c:date`, `c:epoch`)
See “Dynamic values: random and current” below for details and examples.

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

### Headers
For convenience, Multimeter adds a few sensible HTTP headers if they’re missing:
- User-Agent: Multimeter
- Accept: */*
- Connection: keep-alive
- Accept-Encoding: gzip, deflate, br

When a body is present, it also infers Content-Type (json/xml/text) and sets Content-Length.

You can explicitly block any of these by setting the header value to `_` in your API:

```yaml
headers:
  User-Agent: _         # don’t send any UA (prevents axios defaults too)
  Content-Type: _       # don’t infer a content type
  Content-Length: _     # don’t send content length
```

Notes
- Empty or whitespace-only header values are treated as absent and will not be sent.
- Blocking is case-insensitive and prevents library defaults from reappearing.

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

### outputs
Pull fields from the response to populate outputs. Use one of the following per key:
- A regex applied to the raw response body text: `regex ...`
- A bracket path starting with `body[...]` to read structured fields (you can also use `headers[...]` or `cookies[...]`)

Example
```yaml
outputs:
  name: regex message(.*)
  from: body[from][0]
  method: body[method]
```

### setenv
Promote values from `outputs` into the runtime environment.
```yaml
setenv:
  TOKEN: token
```
These become available to subsequent steps/tests as environment variables.

## Dynamic values: random and current
Use built-in dynamic tokens anywhere in url, headers, body, query, cookies, or even in inputs defaults.

Syntax
- Random: `r:<name>` or `<<r:<name>>>`
- Current: `c:<name>` or `<<c:<name>>>`
- Environment: `e:<NAME>` or `<<e:NAME>>`

Resolution rules
- If a field’s value is exactly a single token (e.g. `body: r:int`), the value keeps its native type (number/boolean/string), not a string.
- If a token appears inline within other text, it’s replaced as a string (e.g. `X-Id: user-<<r:uuid>>`).

Common random tokens (`r:`)
- uuid, bool, int
- ip, ipv6
- email, phone
- first_name, last_name, full_name, country
- color
- epoch, epoch_ms
- epoch_past, epoch_past_ms
- epoch_recent, epoch_recent_ms
- epoch_future, epoch_future_ms
- image (small SVG data URI), and other basic generators

Common current tokens (`c:`)
- time, date, day, month, year
- epoch, epoch_ms
- city, country (best effort based on your locale/time zone)

Examples
```yaml
headers:
  X-Req: req-<<r:uuid>>
  X-Now: <<c:date>> <<c:time>>
body:
  id: r:int
  created_at: c:epoch
  active: r:bool
```

CLI and UI both resolve these tokens consistently. Random values are cached per render to keep the UI stable while editing.

## Examples
Define example inputs and (optional) expected outputs so you can run them as smoke tests. When examples exist, the Tests panel shows a dropdown; picking one pre‑fills the inputs, and you can document expected outputs per example.

```yaml
examples:
  - name: happy-path
    description: Login with valid user
    inputs:
      username: alice
      password: secret
    outputs:
      status: 200
      token: "*"   # wildcard/placeholder documentation if exact value varies
  - name: invalid-pass
    inputs:
      username: alice
      password: wrong
    outputs:
      status: 401
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
 outputs:
  total: body[total]
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
 setenv:
  LAST_TOTAL: total
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
- outputs: record<string, string>
- setenv: record<string, string>
- protocol: `http` or `ws`
- method: HTTP verbs (HTTP only)
- format: `json` | `xml` | `text`
- url: string (can contain query string)
- headers: record<string, string>
- query: record<string, string>
- cookies: record<string, string>
- body: string or object (json/xml/text based on format)
- examples: array of { name (required), description?, inputs?, outputs? }
