# Using the panel

## Point your client or tests to it
- In your API `.mmt`, set the base URL to the mock server, for example:
  - `url:` http://localhost:8081
- Or use an environment variable and swap presets between real and mock:
  - variables.api_url: http://localhost:8081
  - tests and APIs reference it via `<<e:api_url>>`

When Reflect is on, you will see the same payload you sent in the response body. Turn it off and set a Status to simulate error paths.

## Request history
The mock server records each incoming request. Use the history view to inspect:
- Method, URL, headers, and body of each request
- Timestamp and order of arrival

This is useful for verifying that your client sends the correct payloads without needing an external tool.

## Notes and limits
- Designed for local development -- do not expose publicly
- State is not persisted between runs
- Response shaping is basic by design; for complex mocking, use [server files](./files.md) or keep Multimeter for authoring/running tests

---

Next: [Mock Server](./index.md) · [TLS](./tls.md) · [Server files](./files.md)
