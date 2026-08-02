# Headers

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
