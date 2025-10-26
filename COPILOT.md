# Multimeter – Copilot instructions

A short, repo-aware guide for how to ask Copilot for help and what patterns to follow in this codebase. Keep prompts specific and reference file paths and symbols.

## Project layout
- VS Code extension (Node/TypeScript): `src/`
- Core library (reused by extension and webview): `core/src/`
- Webview React app (CRA): `mmtview/src/`
- Example .mmt files: `examples/`

Build and tests
- Root build: npm run compile (build core + view, typecheck, lint, esbuild)
- Core: `npm run build --prefix core`
- Webview: `npm run build --prefix mmtview`
- Tests: `npm test`

## Architectural patterns
- Core vs adapter split:
  - Pure core: `core/src` is framework-free. No direct `vscode` or `fs`.
  - VS Code adapter: `src/vscodeNetwork.ts` prepares config and bridges webview `postMessage` to core.
- Network layer (HTTP/WS):
  - Core: `core/src/networkCore.ts`, `core/src/network.ts` expose:
    - `sendHttpRequest(req, config)` and `send(req)` (default config)
    - WebSocket helpers: `createWebSocket`, `addWsConnection`, `wsConnections`, `deleteWsConnection`
    - `handleNetworkMessage(message, config, postMessage)` – stateless, no VS Code APIs
  - VS Code adapter reads settings and files, materializes cert Buffers, and calls core `handleNetworkMessage`.
- JS runner: `core/src/jsRunner.ts` executes generated JS via `new Function`, injects helpers (`testHelper`), `send` from network core, `extractOutputs`, and a console wrapper that logs via the extension output channel.
- Codegen from YAML: `core/src/JSer.ts` converts .mmt YAML to JS (imports, flow steps, repeat time units, checks/assertions).

## Conventions for changes
- Keep the core pure (no `vscode`, `fs`, or UI). Use dependency injection for config and IO.
- When adding APIs for the webview, emit/consume messages via `postMessage` in the adapter (`src/vscodeNetwork.ts`).
- Prefer small, focused modules in `core/src` with explicit types. Reuse the existing request/response shapes.
- UI components live only in `mmtview/src`. Avoid Node-only modules there.
- For browser builds, don’t import `https`, `fs`, or other Node-only APIs.
- Commit messages: Keep them short. Start with the component name in Uppercase (file/module/feature) and avoid generic labels like `docs:`/`feat:`. Examples: `Template URL for env in Jser`, `Rename to-js to print-js in cli`, `Link History doc in README`.

## Common tasks Copilot can help with
- Network core edits: update `core/src/networkCore.ts` and `core/src/network.ts`. Add config fields, extend WS events, or improve error shaping. Ensure no `vscode`/`fs` imports.
- VS Code adapter: change how settings map to `NetworkConfig` in `src/vscodeNetwork.ts`.
- JS runner helpers: adjust `core/src/jsRunner.ts` to inject more helpers or capture outputs.
- Test/codegen: modify `core/src/JSer.ts` to support new flow steps, fix import logic, or change repeat timing.
- React webview: components under `mmtview/src/**`. Use react-complex-tree conventions for test flow UI.

## File and type references
- Network types: `core/src/networkCore.ts` exports `NetworkConfig`, `HttpRequest`, `HttpResponse`.
- Core message router: `core/src/network.ts` exports `NetworkMessage`, `handleNetworkMessage(message, config, postMessage)`.
- VS Code adapter: `src/vscodeNetwork.ts` bridges webview and core.
- Runner: `core/src/jsRunner.ts` exposes `runJSCode(code, title, lg)`.
- Codegen: `core/src/JSer.ts` main exported helpers.

## Patterns and pitfalls
- Certificates: adapter must load cert/key files into Buffers and pass through `NetworkConfig`; core then builds `https.Agent`/WS options. Don’t read files in core.
- Cookies: assemble into `Cookie` header in core HTTP requests.
- Timing: `repeat` supports `ns|ms|s|m|h` in `JSer.ts`. Convert to ms correctly.
- Logging: use the extension output channel via `logToOutput`; user code `console.*` is mapped there.
- Webview focus: stop propagation for inputs when using react-complex-tree to avoid type-to-search stealing focus.

## How to ask Copilot (examples)
- “Add a new field retryCount to NetworkConfig and retry axios requests in `core/src/networkCore.ts` with exponential backoff. Wire through defaults in `send`.”
- “In `core/src/JSer.ts`, add a new step type `delay: '500ms'` and generate `await new Promise(r => setTimeout(r, 500));` accordingly.”
- “In `mmtview/src/test`, make the drag preview show the full TestFlowBox and restrict dragging to the grip icon.”
- “Update `src/vscodeNetwork.ts` to support per-host certificate passphrase if provided.”

## Runbook
- Build all: npm run compile
- Develop extension: npm run watch (then press F5 in VS Code to launch Extension Development Host)
- Run tests: npm test

## Definition of done
- Core builds (tsc) and extension compiles via esbuild.
- Lint passes: eslint src
- Unit tests pass: jest
- Manual smoke: one HTTP request and one WS connect from the UI complete.
