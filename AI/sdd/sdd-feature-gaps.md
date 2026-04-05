# Feature Gaps: Multimeter vs. Market (April 2026)

Gap analysis comparing Multimeter against Postman, Insomnia, Bruno, Hoppscotch, k6, and Karate.

---

## High Priority — Most projects will hit these

| # | Gap | Current State | Competitors |
|---|-----|---------------|-------------|
| 1 | **Authentication helpers** | Manual `Authorization` header only. No OAuth 2.0 flows, Basic Auth builder, API Key, Digest, or AWS Signature. | Postman, Insomnia, Bruno all have dedicated auth sections with auto token refresh. |
| 2 | **Form data & file uploads** | No `multipart/form-data` or `application/x-www-form-urlencoded` body support. Postman converter reads these but the HTTP client cannot send them. | All competitors support form data and file uploads natively. |
| 3 | **GraphQL support** | Not implemented. Marked Priority 3a in `sdd-competitive-strategy.md`. | Postman, Karate, Insomnia, Hoppscotch all support GraphQL. Bruno does not. |
| 4 | **Response schema validation** | `ajv` dependency exists but is unused. Only value-level assertions (`assert`/`check`). No structural/contract validation. | Karate has built-in schema match. Postman uses `tv4`/`ajv` in scripts. |
| 5 | **HTTP proxy configuration** | No `HTTP_PROXY`/`HTTPS_PROXY` support for outbound requests. Mock server has `proxy` field; doc Try buttons have CORS proxy. | All competitors respect standard proxy env vars. Required in enterprise/corporate networks. |

## Medium Priority — Commonly needed in larger projects

| # | Gap | Current State | Competitors |
|---|-----|---------------|-------------|
| 6 | **Load / performance testing** | `TestMetric` fields defined (`repeat`, `threads`, `duration`, `rampup`) but execution engine not implemented. | Karate has Gatling integration. k6 is purpose-built. Others have nothing. |
| 7 | **Per-request timeout** | Global only (`multimeter.network.timeout`, default 30s). Cannot override per API call or test step. | Postman, Insomnia, Bruno all support per-request timeouts. |
| 8 | **Request retry with backoff** | TLS self-signed retry only. No 429/5xx retry, exponential backoff, or `Retry-After` parsing. | k6 has retry policies. Most others rely on scripting. |
| 9 | **Cookie jar / session persistence** | Cookies visible in responses but not auto-forwarded to subsequent requests. Manual chaining required. | Postman, Insomnia auto-persist cookies across requests in a session. |
| 10 | **gRPC / Protocol Buffers** | Not implemented. UI icon exists in history panel only. Priority 3b in strategy. | Postman, Insomnia, Karate support gRPC. |

## Lower Priority — Niche but notable

| # | Gap | Current State | Competitors |
|---|-----|---------------|-------------|
| 11 | **Server-Sent Events (SSE)** | WebSocket supported, SSE not. Growing usage in AI streaming APIs. | Insomnia supports SSE. |
| 12 | **OpenAPI 2.0 (Swagger) import** | Only 3.x supported. Legacy specs still common. | All converters support both 2.0 and 3.x. |
| 13 | **SOAP / WSDL** | XML bodies work but no WSDL-driven generation. | SoapUI specializes here; Postman has basic support. |
| 14 | **Scheduled / monitoring runs** | Relies on CI cron jobs. No built-in scheduler. | Postman Monitors; Insomnia has monitoring. |

---

## Suggested Priority Order

1. Authentication helpers (SDD: `sdd-auth-helpers.md`) — unblocks the widest range of projects
2. Form data & file uploads — common in web APIs
3. GraphQL — large user base, high visibility gap
4. Per-request timeout — small effort, high utility
5. Response schema validation — ajv already bundled
6. HTTP proxy — enterprise adoption blocker
7. Load testing — execution engine for existing data model
