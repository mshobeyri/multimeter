# Try It (interactive API testing)

Add `html.triable: true` to enable Swagger-like "Try" buttons on every endpoint in the HTML doc:

```yaml
type: doc
title: My APIs
sources:
  - ./apis
html:
  triable: true
```

Each endpoint gets a **Try** button on the right side of its header. Clicking it slides open an interactive panel where you can:
- Edit the URL, method, query parameters, headers, and body
- Click **Send** to fire a real HTTP request from the browser
- See the response status, headers, body (auto-formatted JSON), and timing

Each example also gets a small **Try** button that pre-fills the panel with that example's inputs.

### CORS

Browser security blocks requests to APIs on different domains unless the API server sets `Access-Control-Allow-Origin` headers. If your API server doesn't set these headers, you can route requests through a CORS proxy:

```yaml
html:
  triable: true
  cors_proxy: "https://corsproxy.io/?"
```

The proxy URL is prepended to the target URL when sending requests.

---
