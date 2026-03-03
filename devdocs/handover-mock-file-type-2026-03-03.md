# Session Handover: Mock Server File Type (`type: mock`)

**Date:** 2026-03-03
**Branch:** `dev` (on top of `546c350 Revert file name pattern`)
**Status:** Core implementation complete; not committed. Ready for review and remaining SDD phases.

---

## What was done

Implemented SDD phases 1–4 and partial phase 2 (extension integration) of `devdocs/sdd-mock-file-type.md`. The full mock server infrastructure is in place: data model, parser, router, schema validation, autocomplete, webview UI panel, and extension-side server lifecycle.

### Files created (new)

| File | Purpose |
|---|---|
| `core/src/MockData.ts` | TypeScript interfaces: `MockData`, `MockEndpoint`, `MockMatch`, `MockFallback`, `MockTlsConfig`, `MockWsEndpoint`, `MockWsMessage`, `MockProtocol` |
| `core/src/mockParsePack.ts` | `parseMockData(yaml)` — validates & parses raw YAML into `MockData`. Returns `{data, errors}`. Checks: port range, protocol enum, TLS presence for https, endpoint required fields, valid methods/formats/statuses, delay >= 0, duplicate names, unknown keys |
| `core/src/mockServer.ts` | Platform-neutral request router. Exports: `matchPath()` (Express-style `:param`), `autoDetectFormat()`, `partialMatch()` (deep partial object match), `findEndpoint()` (first-match with `x-mock-example` header support), `buildResponse()` (token resolution, path param substitution, header merging, reflect mode, delay), `buildFallbackResponse()`, `createMockRouter()` (returns `(req) => MockResponse`) |
| `core/src/mockServer.test.ts` | 25+ test cases covering: `matchPath`, `autoDetectFormat`, `partialMatch`, `findEndpoint` (method+path, conditional match, named endpoints, header match, query match), `buildResponse` (json/text, path params, delay, reflect, header merging, tokenResolver), `buildFallbackResponse`, `createMockRouter` integration |
| `mmtview/src/mock/MockPanel.tsx` | Main UI panel — server Run/Stop controls, base URL display, protocol/CORS/endpoint-count badges, title/description, endpoint list, fallback/proxy display, live traffic log. Listens for `mockServerStatus` and `mockTrafficEntry` messages from extension |
| `mmtview/src/mock/MockEndpointCard.tsx` | Endpoint card component — colored method badge, path, name badge, match/reflect indicators, status code, format |
| `mmtview/src/mock/MockTrafficLog.tsx` | Live traffic log — timestamp, method, path, status (color-coded: 2xx green, 4xx red, 5xx dark-red), duration. Clear button. Exported `TrafficEntry` interface |
| `src/mmtAPI/mockRunner.ts` | Extension-side server lifecycle: `startMockServer()` (creates HTTP/HTTPS server, wires core router, persists history, streams traffic events to webview), `stopMockServer()`, `isRunning()`, `stopAll()`. Resolves TLS cert paths relative to `.mmt` file. Handles `EADDRINUSE` |
| `devdocs/sdd-mock-file-type.md` | Full SDD with YAML schema, field reference, token system, matching algorithm, UI wireframe, 10-phase implementation plan, open questions |

### Files modified

| File | Change |
|---|---|
| `core/src/CommonData.ts` | Added `"mock"` to `Type` union; added `{ value: "mock", label: "Mock Server" }` to `typeOptions` |
| `core/src/JSerHelper.ts` | `fileType()` now detects `type: mock` |
| `core/src/index.ts` | Barrel exports for `MockData`, `mockParsePack`, `mockServer` |
| `core/package.json` | Sub-path exports: `./MockData`, `./mockParsePack`, `./mockServer` |
| `mmtview/src/App.tsx` | Import `MockPanel`; added `{docType === "mock" && <MockPanel ... />}` routing |
| `mmtview/src/text/Schema.tsx` | Added `MockSchema` (JSON Schema for validation); updated `GeneralSchema` type enum to include `'mock'` |
| `mmtview/src/text/Validate.tsx` | Import `MockSchema`; added `parsedContent.type === 'mock'` validation branch |
| `mmtview/src/text/BeforeMount.tsx` | Added `if (firstLine === "type: mock") return "mock"` to `getParentContext()` |
| `mmtview/src/text/AutoComplete.tsx` | Added: "Mock" type suggestion, `mockSuggestions` (13 top-level props), `mockEndpointSuggestions` (10 endpoint props), `mockMatchSuggestions` (body/headers/query), `mockTlsSuggestions` (cert/key/ca/requestCert), `mockFallbackSuggestions` (status/format/headers/body). Registered in `keySuggestionsByParent` map under keys: `mock`, `endpoints`, `match`, `tls`, `fallback`. Updated `protocolSuggestion` to include `https` |
| `src/mmtAPI/mmtAPI.ts` | Import `mockRunner`; added `startMock`, `stopMock`, `mockStatus` message handler cases |

---

## Build & test status

- **`npm run compile`** — passes with no new errors (only pre-existing warnings)
- **`npm test`** — 48 suites, 422 tests, all pass (includes new `mockServer.test.ts`)
- **Not committed** — all changes are unstaged on `dev` branch

---

## What remains (from SDD)

### Phase 5: YAML editor glyphs / run integration
- Add a run glyph (play button) in the YAML editor gutter for `type: mock` files
- Wire `mockParsePack` validation into the diagnostics system (red squiggles for missing fields, invalid ports, etc.)

### Phase 6: CLI support
- Add `testlight mock path/to/mock.mmt [--port PORT] [--env-file FILE] [-e KEY=VALUE]` command to `mmtcli/src/cli.ts`
- Parse mock file, start server in foreground, log traffic to stdout, Ctrl+C stops

### Phase 7: Documentation
- Create `docs/mock-mmt.md` — user-facing reference
- Update `docs/mock-server.md` — add pointer to `mock-mmt.md`
- Update `docs/mmt-overview.md` — add `type: mock` to file type list

### WebSocket support
- The data model has `MockWsEndpoint` / `MockWsMessage` interfaces but the router and extension runner only handle HTTP/HTTPS. WS support needs: ws message matching in `mockServer.ts`, `WebSocket.Server` creation in `mockRunner.ts`

### Open questions (from SDD)
- Should `proxy` support path rewriting?
- Should mock files support `import` to compose endpoints from multiple files?
- Should WebSocket `messages` support broadcasting vs. reply-to-sender?
- Should the traffic log be opt-in (`log: true`) or always-on?
- Rate limiting / max connections for v1?

---

## Architecture quick reference

```
.mmt file (type: mock)
    │
    ▼
mockParsePack.parseMockData(yaml)  ──→  MockData (validated)
    │
    ▼
mockServer.createMockRouter(data, tokenResolver)  ──→  router(req) → MockResponse
    │
    ▼  (extension-side)
mockRunner.startMockServer(document, webview, provider)
    │  creates http.Server / https.Server
    │  wires router for each request
    │  streams traffic → webview via postMessage
    │  persists history → globalStorage
    │
    ▼  (webview)
MockPanel.tsx  ←── mockServerStatus, mockTrafficEntry messages
    ├── MockEndpointCard.tsx (per endpoint)
    └── MockTrafficLog.tsx (live traffic)
```

---

## Key design decisions

1. **Core is platform-neutral** — `mockServer.ts` has no `fs`, `vscode`, `http` imports. The extension (`mockRunner.ts`) provides the actual Node server and calls core's router.
2. **First-match routing** — endpoints array order matters; first matching endpoint wins. Named endpoints (`x-mock-example` header) take priority.
3. **Token resolution** — `tokenResolver` function is injected into the router. Extension provides one that resolves `e:` from workspace env vars; `r:` and `c:` are resolved by the core `buildResponse` logic using the existing `Random`/`Current` modules.
4. **Schema validation** — `MockSchema` in Schema.tsx mirrors the `MockData` interfaces. `Validate.tsx` uses ajv to validate `type: mock` files.
5. **Autocomplete context** — mock top-level suggestions are keyed under `mock` in `keySuggestionsByParent`. Sub-contexts `endpoints`, `match`, `tls`, `fallback` provide contextual suggestions.

---

## How to test manually

1. Create a file like `examples/mock1.mmt` (see sample in repo)
2. Open it in VS Code — the MockPanel should appear on the right side
3. Click "Run" — server starts on the configured port
4. Send HTTP requests to `http://localhost:<port>/<path>`
5. Traffic entries appear in the panel's Traffic section
6. Click "Stop" to shut down
