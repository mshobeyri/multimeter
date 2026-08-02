# Outputs

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
- **Dot notation** (preferred): `body.field`, `body.nested.items.0.key`
- **Bracket notation**: `body[field]`, `body[nested][items][0]` — required when keys contain dots
- **Regex**, **XML**, and **JSONPath** — see [Advanced outputs](./outputs-advanced.md)

> **Tip:** Prefer dot notation for readability. Use bracket notation only when a key literally contains a `.` character.

Example:

```yaml
outputs:
  status_code: status
  response_time: duration
  method: body.method
  message: body.body.message
  weird_key: body[some.dotted.key]
  token: headers[Authorization]
  session: cookies[session_id]
```

Missing vs null:
- If an extraction path is missing (for example `body.user.missing`), the output value is `omit`.
- If an extraction path exists and its value is literally `null`, the output value is `null`.
- Use this distinction in tests to tell “not present” apart from “present but null”.

```yaml
outputs:
  maybeName: body.user.name
  maybeMiddleName: body.user.middleName
```

- If response is `{ "user": { "name": null } }`: `maybeName` => `null`, `maybeMiddleName` => `omit`.

Next: [Advanced outputs](./outputs-advanced.md) · [Inputs](./inputs.md) · [setenv](./setenv.md)
