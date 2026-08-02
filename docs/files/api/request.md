# Request
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
