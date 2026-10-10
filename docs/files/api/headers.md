# Headers

### Headers
For convenience, Multimeter adds a few sensible HTTP headers if they’re missing:
- User-Agent: Multimeter
- Accept: */*
- Connection: keep-alive
- Accept-Encoding: gzip, deflate, br

When a body is present, it also infers Content-Type (json/xml/text/urlencoded/octet-stream) and sets Content-Length.

You can explicitly block any of these with the `omit` keyword (unquoted):

```yaml
headers:
  User-Agent: omit         # don’t send any UA (prevents axios defaults too)
  Content-Type: omit       # don’t infer a content type
  Content-Length: omit     # don’t send content length
  X-Debug: "omit"          # sends the literal string omit
```

Notes
- Bare `omit` removes the header and blocks Multimeter/axios defaults for that name (case-insensitive).
- `"omit"` (quoted) is the literal string and is sent like any other header value.
- Empty or whitespace-only header values are treated as absent and will not be sent (library defaults such as axios `User-Agent` may still appear unless you use `omit`).
- Blocking `Content-Length` typically sends the body with chunked transfer encoding instead.
- `_` as a header value is deprecated; use `omit` instead. `_` still works for now.
