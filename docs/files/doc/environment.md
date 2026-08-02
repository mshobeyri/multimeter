# Environment variables

Use the `env` key at the doc root to define key-value pairs that replace `e:key` placeholders across all API content in both HTML and Markdown output:

```yaml
type: doc
title: My APIs
sources:
  - ./apis
env:
  url: http://localhost:8080
  token: my-secret-token
```

Every occurrence of `e:url` in API URLs, headers, bodies, descriptions, inputs, query parameters, cookies, and examples is replaced with `http://localhost:8080`. Similarly, `e:token` becomes `my-secret-token`.

Placeholders are resolved **once** at render time. The doc-level `title` and `description` are also resolved.

---
