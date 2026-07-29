# API

Usage-first guide to write APIs in `.mmt` files. Includes HTTP/WS, params, bodies, env, reuse, and a compact reference at the end.

Supported:
- Protocols: `http`, `ws`, `graphql`, `grpc`
- Formats: `json`, `xml`, `xmle`, `text`, `urlencoded`, `binary`
  - Scalar `format: json` applies to both request and response
  - Or split: `format: { request: json, response: xml }`
  - `binary` request bodies use a relative file path; binary **responses** are not supported yet (shown as text)
- Methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`

---

## Quick start

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
Notes
- `format` sets how the body is encoded/decoded (defaults to `json` if omitted)
- Use a single value when request and response share a format, or split them:

```yaml
format:
  request: json
  response: xml
```
- `timeout` overrides the default request timeout for this API call, in milliseconds
- `query` merges with any query string in `url`
- `protocol` is optional - inferred from URL (ws:// or wss:// → ws, otherwise http)

Tip: You can use dynamic tokens anywhere in url/headers/body/query/cookies.
- Random: `r:<name>` (e.g., `r:uuid`, `r:int`)
- Current: `c:<name>` (e.g., `c:date`, `c:epoch`)
See “Dynamic values: random and current” below for details and examples.

You can also import JSON/YAML/CSV data files with a top-level `import:` map and reference values with `${alias.path}`. See [Data Imports](./data-imports.md).

Side note: if you paste a `curl ...` command into an API editor, Multimeter can convert it into `type: api` YAML for you. For HTTP APIs, the toolbar can also run the current request in a terminal using `curl`.

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

Change `format` to `xml` to send XML with self-closing empty tags, or `xmle` for expanded XML with explicit closing tags.

Example using the same YAML body:

```yaml
# self-closing empty tags
format: xml
body:
  user:
    id: 42
    meta: {}
```
Produces:
```xml
<user>
  <id>42</id>
  <meta/>
</user>
```

```yaml
# expanded empty tags
format: xmle
body:
  user:
    id: 42
    meta: {}
```
Produces:
```xml
<user>
  <id>42</id>
  <meta></meta>
</user>
```

### HTTP POST form URL-encoded
```yaml
 type: api
 protocol: http
 url: <<e:api_url>>/login
 method: post
 format: urlencoded
 body:
   username: e:user
   password: e:pass
```

A YAML object body is encoded as `application/x-www-form-urlencoded` (`key=value&key2=value2`). Spaces become `+` and reserved characters are percent-encoded (e.g. `@` → `%40`, `&` → `%26`). Multimeter also sets `Content-Type: application/x-www-form-urlencoded` when it is not already present.

Example:

```yaml
format: urlencoded
body:
  q: hello world
  email: a+b@example.com
```

Produces:

```
q=hello+world&email=a%2Bb%40example.com
```

### HTTP binary file body
```yaml
 type: api
 protocol: http
 url: <<e:api_url>>/upload
 method: post
 format: binary
 body: ./payload.bin
 # optional override:
 # headers:
 #   Content-Type: application/pdf
```

Set `body` to a path relative to the `.mmt` file (same pattern as certificates and imports). At send time Multimeter reads the file as raw bytes. Default `Content-Type` is `application/octet-stream` when you do not set one.

When both request and response formats are binary, you can write `format: binary`. **Binary response handling is not supported yet** — the Response panel still decodes as UTF-8 text and may look garbled.

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

### GraphQL
```yaml
 type: api
 protocol: graphql
 url: <<e:api_url>>/graphql
 auth:
   type: bearer
   token: <<e:token>>
 graphql:
   operation: |
     query GetUsers($limit: Int) {
       users(limit: $limit) { id name email }
     }
   variables:
     limit: 10
   operationName: GetUsers
 outputs:
   firstUser: body.data.users[0].name
```
Notes
- `protocol: graphql` is required — it cannot be inferred from the URL
- The `graphql` block replaces `body`; `method` is always POST and `format` is always JSON
- Outputs are extracted from the standard `{ data, errors }` response shape
- If the response contains an `errors` array, the run is marked as failed

### gRPC
```yaml
 type: api
 protocol: grpc
 url: grpc://localhost:50051
 grpc:
   service: helloworld.Greeter
   method: SayHello
   message:
     name: "World"
 outputs:
   greeting: message.message
```
Notes
- `protocol: grpc` is required — use `grpc://` or `grpcs://` URL schemes
- The `grpc` block replaces `body`, `method`, `format`, `query`, and `cookies`
- `grpc.proto` defaults to `reflect` (server reflection); set it to a `.proto` file path for file-based definitions
- `grpc.stream` supports `server`, `client`, or `bidi` streaming modes; omit for unary calls
- `headers` are sent as gRPC metadata
- Outputs use `message.*` (response message) and `metadata.*` (response metadata) extraction roots
- `auth` maps to metadata: bearer → `authorization: Bearer <token>`, basic → `authorization: Basic <encoded>`

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
- timeout: per-request timeout in milliseconds (optional; overrides the default network timeout)
- format: body format `json` | `xml` | `xmle` | `text` | `urlencoded` | `binary`, or `{ request, response }` when they differ (optional, defaults to `json`)
- headers: HTTP headers
- query: query parameters for HTTP requests
- cookies: HTTP cookies
- body: request body (HTTP) or message (WS)

As noted in the quick start, the body can be raw XML, JSON, text, form fields, or a binary file path. Use `xml` for self-closing empty tags and `xmle` for expanded XML. Use `urlencoded` for form bodies (`key=value&...`). Use `binary` with a relative file path. It can also be a YAML object that’s automatically converted to the specified format (except `binary`, which stays a path string).


Sample:
```yaml
protocol: http
url: x.com/blog
method: get
timeout: 5000
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

When a body is present, it also infers Content-Type (json/xml/text/urlencoded/octet-stream) and sets Content-Length.

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

### Auth
Use the `auth` field for built-in authentication. It generates the appropriate header (or query parameter) automatically. Explicit `headers.Authorization` always takes precedence.

#### Bearer token
```yaml
auth:
  type: bearer
  token: <<e:token>>
```
Generates: `Authorization: Bearer <resolved-token>`

#### Basic auth
```yaml
auth:
  type: basic
  username: <<e:user>>
  password: <<e:pass>>
```
Generates: `Authorization: Basic <base64(username:password)>`

#### API key (header)
```yaml
auth:
  type: api-key
  header: X-API-Key
  value: <<e:api_key>>
```
Generates: `X-API-Key: <resolved-value>`

#### API key (query parameter)
```yaml
auth:
  type: api-key
  query: api_key
  value: <<e:api_key>>
```
Appends `?api_key=<resolved-value>` to the query parameters.

#### OAuth 2.0 client credentials
```yaml
auth:
  type: oauth2
  grant: client_credentials
  token_url: https://auth.example.com/token
  client_id: <<e:client_id>>
  client_secret: <<e:client_secret>>
  scope: read write
```
At runtime, fetches an access token from `token_url` and sets `Authorization: Bearer <access_token>`.

Notes
- All `auth` field values support environment variables (`<<e:var>>`), inputs (`<<i:param>>`), and random tokens (`r:uuid`).
- Auth headers are masked in logs to prevent accidental credential exposure.

## GraphQL

Set `protocol: graphql` to send GraphQL operations over HTTP POST. The `graphql` block defines the operation and variables — it replaces `body`, `method`, and `format`.

### graphql block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | string | Yes | The GraphQL query, mutation, or subscription string |
| `variables` | object | No | Variables passed to the operation |
| `operationName` | string | No | Selects a named operation when `operation` contains multiple |

### Inputs and variables
Use `inputs` with `<<i:name>>` tokens inside `graphql.variables` to parameterize operations:
```yaml
 protocol: graphql
 url: <<e:api_url>>/graphql
 inputs:
   userId:
     type: number
     default: 1
   includeEmail:
     type: boolean
     default: true
 graphql:
   operation: |
     query GetUser($id: ID!, $withEmail: Boolean!) {
       user(id: $id) {
         name
         email @include(if: $withEmail)
       }
     }
   variables:
     id: <<i:userId>>
     withEmail: <<i:includeEmail>>
```

### Outputs and extraction
GraphQL responses follow the `{ data, errors }` shape. Extract values using `body.data.*`:
```yaml
 outputs:
   userName: body.data.user.name
   postCount: body.data.user.posts.length
   hasErrors: body.errors
   traceId: headers[x-trace-id]
   statusCode: status
   responseTime: duration
```

### Error handling
If the response body contains an `errors` array, the run is marked as failed and the errors are logged. This catches GraphQL-level errors even when the HTTP status is 200.

### What the graphql block replaces
- `body` — ignored; the request body is built from `graphql.operation` + `graphql.variables`
- `method` — always POST
- `format` — always JSON
- `query`, `cookies` — not used (can still be set but are uncommon for GraphQL)
- `headers`, `auth`, `inputs`, `outputs`, `examples`, `setenv` — work identically to HTTP

---

## gRPC

Set `protocol: grpc` to make gRPC remote procedure calls. The `grpc` block defines the service, method, and message — it replaces `body`, `method`, `format`, `query`, and `cookies`.

### grpc block

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `proto`   | string | No       | Path to `.proto` file, or `"reflect"` for server reflection (default: `"reflect"`) |
| `service` | string | Yes      | Fully-qualified gRPC service name (e.g. `helloworld.Greeter`) |
| `method`  | string | Yes      | RPC method name (e.g. `SayHello`) |
| `stream`  | string | No       | Streaming mode: `server`, `client`, or `bidi`. Omit for unary calls |
| `message` | object | No       | Request message as key-value pairs |

### URL scheme

Use `grpc://host:port` for plaintext or `grpcs://host:port` for TLS connections:

```yaml
 url: grpc://localhost:50051      # plaintext
 url: grpcs://api.example.com:443  # TLS
```

### Service definition

By default, multimeter uses gRPC server reflection to discover service definitions at runtime. To use a `.proto` file instead:

```yaml
 grpc:
   proto: ./protos/greeter.proto
   service: helloworld.Greeter
   method: SayHello
```

### Extracting outputs

gRPC responses use `message.*` for the response message and `metadata.*` for trailing metadata:

```yaml
 outputs:
   greeting: message.message
   requestId: metadata.x-request-id
   responseTime: duration
   grpcStatus: status
```

`body.*` and `headers.*` also work and map to `message` and `metadata` respectively.

### Streaming

Set `grpc.stream` for streaming RPCs:

```yaml
 grpc:
   service: chat.ChatService
   method: StreamMessages
   stream: server
   message:
     channel: general
```

For server streaming, the response `message` contains all collected messages as an array. Client and bidi streaming send the message object as a single frame.

### What the grpc block replaces
- `body` — ignored; the request payload comes from `grpc.message`
- `method`, `format` — not applicable to gRPC
- `query`, `cookies` — not used for gRPC
- `headers` — sent as gRPC metadata
- `auth` — maps to metadata (bearer → `authorization` header, basic → `authorization` header)
- `inputs`, `outputs`, `examples`, `setenv` — work identically to HTTP

---

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
- You can append **accessors** when only part of a value is needed:
  - `<<i:user.name>>` — property access
  - `<<i:tags[0]>>` — array/string index access
  - `<<i:message[0:3]>>` — string/array slice (end-exclusive)

Input keyword values:
- `omit` (unquoted) removes the target field from request objects (headers/query/cookies/body). In arrays it keeps index shape by writing `null`.
- `null` (unquoted) sends a JSON/YAML null value.
- `"omit"` and `"null"` are literal strings (quoted on purpose) and stay strings after formatting.
- This applies to top-level `inputs`, call-time `inputs`, CLI `-e key=value`, and API Tester input overrides.

Example:
```yaml
inputs:
  username: alice
  role: admin
body:
  username: i:username
  user_initial: <<i:username[0]>>
  role_short: <<i:role[0:3]>>
```

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

XML responses (detected from `Content-Type` or a leading `<`) are navigated with the same paths:
- The XML declaration (`<?xml …?>`), doctypes and comments are ignored, so paths start at the root element: `body.root.id`.
- Repeated elements are arrays: `body.root.tags.tag` returns all of them, `body.root.tags.tag.2` the third. Index `.0` also works when only one element is present.
- Attributes are plain keys on their element: `body.root.nested.enabled`, `body.root.nested.item.1.key`.
- Element text is a string (`"true"`, `"42"`); empty elements return `""`. Compare with the type-unsafe operators `=~` / `!~` when the expected value is a YAML boolean or number.

```yaml
outputs:
  id: body.root.id             # <id>1</id>            => "1"
  tags: body.root.tags.tag     # repeated <tag>        => ["api", "testing"]
  firstTag: body.root.tags.tag.0
  enabled: body.root.nested.enabled   # attribute      => "true"
  betaKey: body.root.nested.item.1.key
```

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

Missing vs null behavior:
- If an extraction path is missing (for example `body.user.missing`), the output value is `omit`.
- If an extraction path exists and its value is literally `null`, the output value is `null`.
- Use this distinction in tests/debugging to tell “not present” apart from “present but null”.

Example:
```yaml
outputs:
  maybeName: body.user.name
  maybeMiddleName: body.user.middleName
```
- If response is `{ "user": { "name": null } }`:
  - `maybeName` => `null`
  - `maybeMiddleName` => `omit`

JSONPath syntax: `$` references the root response object. Use `$[body][key]` or `$body[key]` to drill into the body, headers, or cookies sections. This is an alternative to the `body[...]` bracket notation.

### setenv
Promote values from the response into the runtime environment after an API run.

Values use the **same extraction expressions as `outputs`** (paths, regex, keywords):
```yaml
outputs:
  token: body.access_token
setenv:
  TOKEN: body.access_token
  USER_ID: body.user.id
```

These become available to subsequent steps/tests as environment variables (`e:TOKEN`, `<<e:TOKEN>>`).

Deprecated: referencing an `outputs` key by name still works for compatibility:
```yaml
setenv:
  TOKEN: token   # deprecated — prefer body.access_token
```
In the YAML editor, deprecated values are struck through; click to replace them with the output’s extraction expression.

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
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.

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
 setenv:
  last_total: body[total]
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

### GraphQL
```yaml
 type: api
 title: Get Users
 tags:
   - user
   - graphql
 description: Fetch paginated users with their posts
 protocol: graphql
 url: <<e:api_url>>/graphql
 auth:
   type: bearer
   token: <<e:token>>
 inputs:
   limit:
     type: number
     default: 10
   offset:
     type: number
     default: 0
 outputs:
   userCount: body.data.users.length
   firstUser: body.data.users[0].name
 graphql:
   operation: |
     query GetUsers($limit: Int, $offset: Int) {
       users(limit: $limit, offset: $offset) {
         id
         name
         email
         posts { title }
       }
     }
   variables:
     limit: <<i:limit>>
     offset: <<i:offset>>
   operationName: GetUsers
 examples:
   - name: first-page
     inputs:
       limit: 5
       offset: 0
     outputs:
       userCount: 5
   - name: second-page
     inputs:
       limit: 5
       offset: 5
```

---

## Reference (types)
- type: `api`
- title: string
- tags: string[]
- description: string
- inputs: record<string, string | number | boolean | null> (+ `omit` keyword)
- outputs: record<string, string>
- setenv: record<string, string>  # env name → extraction expression (same DSL as outputs; legacy: outputs key name)
- url: string (can contain query string)
- protocol: `http` | `ws` | `graphql`
- method: HTTP verbs (HTTP only)
- format: `json` | `xml` | `xmle` | `text` | `urlencoded` | `binary` | `{ request, response }`
- headers: record<string, string>
- query: record<string, string>
- cookies: record<string, string>
- body: string or object (json/xml/text/urlencoded based on format; relative path string when format is binary; not used with graphql)
- graphql: { operation: string (required), variables?: object, operationName?: string }
- auth: `none` | { type: `bearer`, token } | { type: `basic`, username, password } | { type: `api-key`, header|query, value } | { type: `oauth2`, grant, token_url, client_id, client_secret, scope? }
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
