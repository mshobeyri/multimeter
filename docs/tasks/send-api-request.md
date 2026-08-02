# Send an API request

Use `type: api` when you want a reusable request definition — method, URL, headers, body, and optional inputs/outputs.

## Minimal example

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

Open the file in VS Code and click **Send**. The Response panel shows the result.

## Tips

- Prefer `format: json` (or `yaml`) so the body editor and docs stay structured.
- Add `inputs` when callers should pass values; use `<<i:name>>` in the URL or body.
- Add `outputs` to extract fields for tests and chained calls.

## Learn more

- [API files](../files/api.md)
- Example: [Simple API](/docs/examples/basic/01_simple_api)
