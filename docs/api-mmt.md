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
 url: <<e:api_url>>/users   # protocol inferred as http from URL
 method: get
 format: json   # affects default Content-Type and body handling
 headers:
   Session: e:token
 query:
   limit: "10"
   sort: desc
```
Notes
- `format` sets how the body is encoded/decoded
- `query` merges with any query string in `url`
- `protocol` is optional - inferred from URL (ws:// or wss:// → ws, otherwise http)

Tip: You can use dynamic tokens anywhere in url/headers/body/query/cookies.
- Random: `r:<name>` (e.g., `r:uuid`, `r:int`)
- Current: `c:<name>` (e.g., `c:date`, `c:epoch`)
See “Dynamic values: random and current” below for details and examples.

### HTTP POST JSON or XML
```yaml
 type: api
 protocol: http
 url: <<e:api_url>>/login
 method: post
 format: json
 headers:
   X-App: multimeter
 body:
   username: e:user
   password: e:pass
```

Change `format` to `xml` to send an XML body instead of JSON.

### HTTP raw text or raw XML
```yaml
# text
 type: api
 protocol: http
 url: <<e:api_url>>/echo
 method: post
 format: text
 body: |
   hello world

# xml
 type: api
 protocol: http
 url: <<e:api_url>>/xml
 method: post
 format: xml
 body: |
   <root>
    <value>42</value>
  </root>
```

### WebSocket
```yaml
 type: api
 protocol: ws
 url: ws://localhost:8080/ws
 format: json
 headers:
   X-Auth: e:token
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
The following fields make it easy to search, filter, and auto-document APIs:
- title: API title
- tags: related tags
- description: short explanation of the API (supports Markdown formatting: **bold**, *italic*, `code`, lists, headings, and tables). For multiline descriptions use `|-` (literal block, strip trailing newline).

Sample:
```yaml
type: api
title: generate session
description: |-
  Create a session from **username** and **password**.

  Returns:
  - `token`: JWT session token
  - `expires_in`: token TTL in seconds
tags:
  - smoke
  - authentication
```

### File references in descriptions

A description is automatically recognised as a file reference when it is a single token (no spaces), on one line, and contains `.md#`. The path is resolved relative to the current `.mmt` file.

```yaml
description: README.md#-why-multimeter
```

- In the **editor**, the path is highlighted and Ctrl+click (Cmd+click on macOS) opens the referenced file.
- In the **description preview**, the link is clickable and opens the file.
- In **generated HTML docs**, it renders as a highlighted link.
- In **generated Markdown docs**, it renders as a standard markdown link.

## Request
- protocol: `http` or `ws` (optional - inferred from URL if not specified)
  - URLs starting with `ws://` or `wss://` default to `ws`
  - All other URLs default to `http`
- url: server URL
- method: HTTP method `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`
- format: body format `json` | `xml` | `text`
- headers: HTTP headers
- query: query parameters for HTTP requests
- cookies: HTTP cookies
- body: request body (HTTP) or message (WS)

As noted in the quick start, the body can be raw XML, JSON, or text. It can also be a YAML object that’s automatically converted to the specified format.


Sample:
```yaml
protocol: http
url: x.com/blog
method: get
headers:
  Authorization: Bearer <<e:token>>
  Accept: application/json
query:
  limit: "20"
  page: "1"
  # will be converted to x.com/blog?limit=20&page=1
cookies:
  session: e:session_id
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
 url: <<e:api_url>>/users/<<i:userId>>
 method: get
 format: json
```

Notes
- `<<i:key>>` can appear inside `url`, `headers`, and `body`
- Declare input names under `inputs:` (string/number/boolean/null)

### outputs
Map response data to named output variables. Keys are the exported names (used in tests via `expect` or `id`), values are extraction expressions using these keywords:

| Keyword | Description |
|---------|-------------|
| `body` | Full response body, or path into it: `body.field`, `body[field][sub]` |
| `header` / `headers` | All response headers, or a specific one: `header[Content-Type]`, `headers.Authorization` |
| `status` | HTTP status code (number, e.g. 200, 404) |
| `details` | Full request/response details as JSON string |
| `duration` | Response time in milliseconds (number) |
| `cookies` | Response cookies: `cookies[name]`, `cookies.name` |

Additional extraction styles:
- **Dot notation** (preferred): `body.field`, `body.nested.items.0.key` — shorter and easier to read
- **Bracket notation**: `body[field]`, `body[nested][items][0]` — required when keys contain dots (e.g. `body[my.key.name]`)
- **Regex extraction**: `body[/pattern/]` or `body./pattern/` — apply a regex to the response body text
- **Header regex**: `headers[/pattern/]` or `headers./pattern/` — apply a regex to the response headers
- **Cookie regex**: `cookies[/pattern/]` or `cookies./pattern/` — apply a regex to the response cookies
- A JSONPath starting with `$` (e.g., `$[body][user][id]` or `$body[user]`)

> **Tip:** Prefer dot notation for readability. Use bracket notation only when a key literally contains a `.` character, since dot notation would interpret it as a path separator.

> **Regex tip:** If the regex contains a capture group `(...)`, the first group is returned. If there is no capture group, the entire match is returned.

Example
```yaml
outputs:
  # Plain keywords
  status_code: status
  response_time: duration
  req_res_details: details

  # Dot notation (preferred)
  method: body.method
  message: body.body.message

  # Bracket notation (needed for keys with dots)
  weird_key: body[some.dotted.key]

  # Regex extraction from body
  name: body[/message(.*)/]
  email: body./"email":\s"([^"]+)"/

  # Regex extraction from headers
  auth_token: headers[/Bearer (\S+)/]

  # Other extraction styles
  from: body[from][0]
  token: headers[Authorization]
  content_type: header[Content-Type]
  session: cookies[session_id]
  userId: $[body][user][id]
```

JSONPath syntax: `$` references the root response object. Use `$[body][key]` or `$body[key]` to drill into the body, headers, or cookies sections. This is an alternative to the `body[...]` bracket notation.

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
- latitude, longitude
- hex_color
- weekday, month
- date_future, date_past, date_recent
- phone_number (alias for phone)

Common current tokens (`c:`)
- time, date, day, month, year
- epoch, epoch_ms
- city, country (best effort based on your locale/time zone)

Token name normalization: `r:firstName`, `r:first-name`, and `r:first_name` all resolve to the same token. Underscores, hyphens, and casing are ignored when matching token names.

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

## UI features
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values in the response panel can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

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
 url: <<e:api_url>>/users/search
 method: get
 format: json
 headers:
   Authorization: Bearer <<e:token>>
   X-Client: test
 query:
   q: john
   limit: "10"
 cookies:
   locale: en-US 
 setenv:
  last_total: total
```

### WS
```yaml
 type: api
 title: Notifications stream
 protocol: ws
 url: wss://example.com/ws
 format: json
 headers:
   X-Auth: e:token
 # Drive messages in a test using steps
```

---

## Reference (types)
- type: `api`
- title: string
- tags: string[]
- description: string
- inputs: record<string, string | number | boolean | null>
- outputs: record<string, string>
- setenv: record<string, string>
- url: string (can contain query string)
- protocol: `http` or `ws`
- method: HTTP verbs (HTTP only)
- format: `json` | `xml` | `text`
- headers: record<string, string>
- query: record<string, string>
- cookies: record<string, string>
- body: string or object (json/xml/text based on format)
- examples: array of { name (required), description?, inputs?, outputs? }

---

## See also
- [Test](./test-mmt.md) — orchestrate flows calling APIs with steps, assertions, and loops
- [Environment](./environment-mmt.md) — define variables and presets used by `e:VAR` tokens
- [Doc](./doc-mmt.md) — generate browsable HTML documentation from API files
- [Suite](./suite-mmt.md) — group and run multiple tests and APIs together
- [Mock Server](./mock-server.md) — point API URLs at a mock server for local development
- [Testlight CLI](./testlight.md) — run APIs and tests from the command line
- [Reports](./reports.md) — generate JUnit XML, HTML, Markdown, or MMT reports from test runs
- [Certificates](./certificates-mmt.md) — SSL/TLS and mTLS configuration
- [Logging](./logging.md) — log levels for inputs, outputs, requests, and responses
- [Sample Project](./sample-project.md) — full walkthrough with APIs, tests, suites, and docs
