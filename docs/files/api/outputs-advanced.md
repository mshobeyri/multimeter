# Advanced outputs

Regex, XML, and JSONPath extraction for [Outputs](./outputs.md).

#### Regex extraction

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

#### XML responses

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

#### JSONPath

A JSONPath starting with `$` (e.g. `$[body][user][id]` or `$body[user]`) is an alternative to bracket notation. `$` references the root response object; drill into body, headers, or cookies with `$[body][key]` or `$body[key]`.

```yaml
outputs:
  userId: $[body][user][id]
  from: body[from][0]
```

See also: [Outputs](./outputs.md) · [Assert operators](../test/steps/assert-operators.md) · [Inputs](./inputs.md)
