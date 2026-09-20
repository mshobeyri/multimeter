# Request body

`body` is the request payload for HTTP APIs, or the message for WebSocket sends.

It can be:

- A **YAML object** — converted to the specified [format](./format.md) (JSON, XML, urlencoded, …)
- A **YAML list** — JSON array bodies, or `format: multipart` parts (`name` + `value` or `file`)
- A **raw string** — for `text`, `xml`, or literal XML/JSON when you want full control
- A **relative file path** — when `format` is `binary` (e.g. `./payload.bin`)

```yaml
format: json
body:
  username: demo
  password: secret
```

```yaml
format: text
body: |
  hello world
```

```yaml
format: binary
body: ./payload.bin
```

Use `none` to send no request body. Use `xml` for self-closing empty tags and `xmle` for expanded XML. Use `urlencoded` for form bodies (`key=value&...`). With `binary`, Multimeter reads the file at send time; the path stays a string in YAML.

With `multipart`, `body` is a **list of parts**. Each part has `name` plus either `value` (text) or `file` (path relative to the `.mmt` file). The visual editor shows a parts table (name, Text or File, value or path) instead of a JSON array:

```yaml
format: multipart
body:
  - name: description
    value: hello from multipart
  - name: file
    file: ./assets/sample.txt
```

Runnable walkthrough with one file per format: [HTTP body formats example](../../../../examples/intermediate/28_http_body_formats/README.md). POST examples for each `format:` [HTTP bodies](../protocols/http-bodies.md).

See also: [Format](./format.md) · [Body overview](./index.md) · [Request fields](../index.md#request)
