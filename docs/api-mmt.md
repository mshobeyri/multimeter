# API

Usage-first guide to author APIs in `.mmt` files. Includes HTTP/WS, params, bodies, env, reuse, and a compact reference at the end.

Supported protocols: `http`, `ws` • Formats: `json`, `xml`, `text` • Methods: `get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`

---

## Define APIs

### HTTP quick start (GET)
```yaml
 type: api
 protocol: http
 format: json   # affects default Content-Type and body handling
 method: get
 url: <e:API_URL>/users?active=true
 headers:
   Authorization: Bearer <e:TOKEN>
 query:
   limit: "10"
   sort: desc
```
Notes
- `format` sets how the body is encoded/decoded
- `query` merges with any query string in `url`

### HTTP quick start (POST JSON)
```yaml
 type: api
 protocol: http
 format: json
 method: post
 url: <e:API_URL>/login
 headers:
   X-App: multimeter
 body:
   username: e:USER
   password: e:PASS
```

### HTTP with raw text or XML
```yaml
# text
 type: api
 protocol: http
 format: text
 method: post
 url: <e:API_URL>/echo
 body: |
   hello world

# xml
 type: api
 protocol: http
 format: xml
 method: post
 url: <e:API_URL>/xml
 body: |
   <root><value>42</value></root>
```

### WebSocket (WS)
```yaml
 type: api
 protocol: ws
 format: json
 url: ws://localhost:8080/ws
 headers:
   X-Auth: <e:TOKEN>
 # drive messages in tests via call steps
```
Tip: For WS, use tests to send/receive frames with `call` steps that invoke this API.

---

## Send requests (params + bodies)

### URL, Query, Headers, Cookies
```yaml
headers:
  Authorization: Bearer <e:TOKEN>
  Accept: application/json
query:
  limit: "20"
  page: "1"
cookies:
  session: e:SESSION_ID
```
- Values are strings and can use env tokens
- `query` merges with any query string in `url`

### Body formats and Content-Type (recommended)
Author bodies in YAML and get the right wire format automatically.

- JSON request (recommended): `format: json` + YAML object `body` → serialized to JSON; `Content-Type: application/json` by default.
```yaml
 type: api
 protocol: http
 format: json
 method: post
 url: <e:API_URL>/items
 body:
   id: 123
   name: "Widget"
   tags: [a, b]
```

- YAML payload (server expects YAML): `format: text` + block string `body` + explicit header.
```yaml
 type: api
 protocol: http
 format: text
 method: post
 url: <e:API_URL>/ingest-yaml
 headers:
   Content-Type: application/yaml
 body: |
   id: 123
   name: Widget
   tags:
     - a
     - b
```

- XML payload: `format: xml` + string `body`; optionally set `Content-Type: application/xml`.
```yaml
 type: api
 protocol: http
 format: xml
 method: post
 url: <e:API_URL>/ingest-xml
 headers:
   Content-Type: application/xml
 body: |
   <root><id>123</id><name>Widget</name></root>
```
Tip: If you set `headers.Content-Type`, it overrides the default implied by `format`.

---

## Reuse and compose (inputs, extract, outputs, env, data)

### Inputs (parameterize APIs)
Declare inputs and reference them with `<i:key>` in url/headers/body.
```yaml
 type: api
 title: Get user by ID
 inputs:
   userId: string
 protocol: http
 format: json
 method: get
 url: <e:API_URL>/users/<i:userId>
```
Use in a test
```yaml
steps:
  - call: getUser
    id: u1
    inputs: { userId: "123" }
  - assert: $.u1.status == 200
```
Notes
- `<i:key>` can appear inside `url`, `headers`, and `body`
- Declare input names under `inputs:` (string/number/boolean/null)

### Extract (pull fields from the response)
Add named extraction rules (JSONPath-like) to reuse values or promote to env.
```yaml
extract:
  # HTTP metadata
  status: $.status               # 200
  statusText: $.statusString     # e.g., OK
  contentType: $.headers['content-type']
  
  # Request context
  q: $.query.q
  session: $.cookies.session

  # Body content
  id: $.body.id
  firstName: $.body.user.name.first
  itemsCount: $.body.items.length
```

### Outputs (document exported values)
Describe the shape/type of values exposed by this API for downstream consumers.
```yaml
outputs:
  id: string
  status: number
  name: string
```
Tip: Pair `extract` with `outputs` so tests can reference `$.<stepId>.<key>` with confidence.

### setenv (promote values to environment)
Promote values (often from `extract`) into the runtime environment.
```yaml
setenv:
  TOKEN: $.body.token
  USERNAME: <e:USER>
```
These become available to subsequent steps/tests as env variables.

### Import and data alias (CSV)
Import CSV and expose an alias to scripts.
```yaml
import:
  users: ./users.csv
# Optional direct alias available in scripts as $.data
data: users
```
- `import` maps alias → CSV path
- `data` references a single imported alias

### Examples block (document request shapes)
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

### Environment tokens (supported forms)
- `e:VAR`
- `<e:VAR>`
- `<<e:VAR>>`
Note: `e:{VAR}` is not supported.

### Validation and requirements
- For `protocol: http`, `method` is required
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)

---

## Complete examples

### HTTP
```yaml
 type: api
 title: Search users
 tags: [user, search]
 description: Full-text search on users
 protocol: http
 format: json
 method: get
 url: <e:API_URL>/users/search
 headers:
   Authorization: Bearer <e:TOKEN>
   X-Client: test
 query:
   q: john
   limit: "10"
 cookies:
   locale: en-US
 extract:
   total: $.body.total
 setenv:
   LAST_TOTAL: $.body.total
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
   X-Auth: <e:TOKEN>
 # Drive messages in a test using steps
```

---

## Reference (types)
- type: `api`
- title: string
- tags: string[]
- description: string
- import: record<string,string>
- data: string (alias of an imported CSV)
- inputs: record<string, string|number|boolean|null>
- outputs: record<string, string|number|boolean|null>
- extract: record<string, string>
- setenv: record<string, string>
- protocol: `http` or `ws`
- method: HTTP verbs (HTTP only)
- format: `json` | `xml` | `text`
- url: string (can contain query string)
- headers: record<string,string>
- query: record<string,string>
- cookies: record<string,string>
- body: string or object (json/xml/text based on format)
- examples: array of { name (required), description?, inputs? }
