# Inputs

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
- Removal happens for every request format: JSON keys, XML elements and attributes, `urlencoded` pairs, headers, cookies, and query values (including query pairs written inline in `url`).

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

Example — omitting an input from a test `call`:
```yaml
steps:
  - call: echo
    inputs:
      message: omit
```
The request is sent without `message` at all; nothing named `omit` is sent as a value.
