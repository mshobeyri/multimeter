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

## JSON path

For JSON responses, drill into `body`, `headers`, or `cookies` with dot or bracket notation, or with a JSONPath starting with `$`.

- **Dot notation** (preferred): `body.field`, `body.nested.items.0.key`
- **Bracket notation**: `body[field]`, `body[nested][items][0]` — required when keys contain dots

> **Tip:** Prefer dot notation for readability. Use bracket notation only when a key literally contains a `.` character.

A JSONPath starting with `$` (e.g. `$[body][user][id]` or `$body[user]`) is an alternative to bracket notation. `$` references the root response object; drill into body, headers, or cookies with `$[body][key]` or `$body[key]`.

```yaml
outputs:
  method: body.method
  message: body.body.message
  weird_key: body[some.dotted.key]
  userId: $[body][user][id]
  from: body[from][0]
```

## XML path

XML (detected from `Content-Type` or a leading `<`) uses the same path syntax as JSON:

- The XML declaration (`<?xml …?>`), doctypes and comments are ignored; paths start at the root element: `body.root.id`.
- Repeated elements are arrays: `body.root.tags.tag` returns all of them, `body.root.tags.tag.2` the third. Index `.0` also works when only one element is present.
- Attributes are plain keys on their element: `body.root.nested.enabled`.
- Element text is a string (`"true"`, `"42"`); empty elements return `""`. Compare with type-unsafe operators `=~` / `!~` when the expected value is a YAML boolean or number.

```yaml
outputs:
  id: body.root.id             # <id>1</id>            => "1"
  tags: body.root.tags.tag     # repeated <tag>        => ["api", "testing"]
  firstTag: body.root.tags.tag.0
  enabled: body.root.nested.enabled   # attribute      => "true"
  betaKey: body.root.nested.item.1.key
```

## Regex

- **Body**: `body[/pattern/]` or `body./pattern/`
- **Headers**: `headers[/pattern/]` or `headers./pattern/`
- **Cookies**: `cookies[/pattern/]` or `cookies./pattern/`

> **Regex tip:** If the regex contains a capture group `(...)`, the first group is returned. If there is no capture group, the entire match is returned.

```yaml
outputs:
  name: body[/message(.*)/]
  email: body./"email":\s"([^"]+)"/
  auth_token: headers[/Bearer (\S+)/]
```

Next: [Inputs](./inputs.md) · [setenv](./setenv.md) · [check operators](../test/steps/check.md#operators)
