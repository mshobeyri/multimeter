# HTTP bodies

POST and body format variants for [HTTP](./http.md) APIs.

### HTTP POST JSON or XML

```yaml
type: api
protocol: http
url: https://test.mmt.dev/post
method: post
format: json
headers:
  X-App: multimeter
body:
  username: demo
  password: secret
```

Change `format` to `xml` for self-closing empty tags, or `xmle` for expanded XML with explicit closing tags.

```yaml
format: xml   # or xmle
body:
  user:
    id: 42
    meta: {}
```

`xml` produces `<meta/>`; `xmle` produces `<meta></meta>`.

### HTTP POST form URL-encoded

```yaml
type: api
protocol: http
url: https://test.mmt.dev/post
method: post
format: urlencoded
body:
  username: demo
  password: secret
```

A YAML object body is encoded as `application/x-www-form-urlencoded`. Spaces become `+` and reserved characters are percent-encoded. Multimeter sets `Content-Type: application/x-www-form-urlencoded` when it is not already present.

Example body `{ q: hello world, email: a+b@example.com }` produces `q=hello+world&email=a%2Bb%40example.com`.

### HTTP binary file body

```yaml
type: api
protocol: http
url: https://test.mmt.dev/post
method: post
format: binary
body: ./payload.bin
# optional: headers.Content-Type: application/pdf
```

`body` is a path relative to the `.mmt` file. At send time Multimeter reads the file as raw bytes. Default `Content-Type` is `application/octet-stream`. **Binary response handling is not supported yet** — the Response panel still decodes as UTF-8 text.

### HTTP raw text or raw XML

```yaml
# text
type: api
url: https://test.mmt.dev/post
method: post
format: text
body: |
  hello world

# xml (literal string body)
type: api
url: https://test.mmt.dev/post
method: post
format: xml
body: |
  <root>
    <value>42</value>
  </root>
```

See also: [HTTP](./http.md) · [Outputs](../outputs.md) · [Request](../request.md)
