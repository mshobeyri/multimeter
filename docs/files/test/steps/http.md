# http

Send an HTTP request directly from the test without importing a separate `type: api` file. Useful for setup, teardown, health checks, or small one-off requests.

```yaml
steps:
  - http: https://test.mmt.dev/json
    id: sample
    method: get
    format: json
    expect:
      status: 200
```

Direct HTTP steps use the same HTTP request fields as API files where they make sense: `query`, `method`, `timeout`, `format`, `headers`, and `body`.

Notes:
- `http` is the request URL and is required.
- `method` defaults to `get` if omitted.
- `timeout` overrides the default request timeout for this step, in milliseconds.
- `id` is optional, but recommended when you want to reference the response in later steps.
- Inline `expect`, `debug`, and `report` work the same way as on `call` steps.
- The response exposed through `id` includes `body`, `headers`, `cookies`, `status`, and `duration`.
- In the Multimeter editor, **Ctrl+click** (⌘+click on macOS) the `http:` URL to open a temporary `type: api` file with the same request data. It appears in the [Temp Files](../../../panels/temp-files.md) panel.

Example using the response later in the `flow:`

```yaml
steps:
  - http: https://test.mmt.dev/status/200
    id: health
    method: get
    expect:
      status: 200
  - if: ${health.status} == 200
    steps:
      - print: Service is healthy
```
