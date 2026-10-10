# Panels

Multimeter’s VS Code panels sit in the activity bar (left) and in the bottom Multimeter panel.

Click the Multimeter activity icon in the sidebar to open the activity-bar views. Environment and History live in the bottom panel area (`View → Open View…` or the Multimeter panel tab).

## Views dock

The top of the Multimeter sidebar is a collapsed **Views** tree. Use it to relocate Multimeter panels between the activity bar and the bottom panel (or another sidebar):

1. Drag a view’s title onto the **Views** header (or use the view’s context menu → **Move View**).
2. Click a row in **Views** to focus that panel again.

Listed views: Temp Files, Get Started, Mock Server, Connections, Environment Variables, and History. Welcome text on an empty dock also links to Environment and History.

## Activity bar

| Control | What it does |
|---|---|
| {{btn:file:Temp Files}} | Scratch `.mmt` drafts you can pin, archive, or save later — see [Temp Files](./temp-files.md) |
| {{btn:rocket:Get Started}} | First-request walkthrough (create a POST, send, change the body) — see [Get Started](./get-started.md) |
| {{btn:server:Mock Server}} | Start HTTP/HTTPS/WebSocket mocks, or load a `type: server` file — see [Mock server panel](../files/server/panel.md) |
| {{btn:plug:Connections}} | Watch active HTTP keep-alive and WebSocket sessions; close them when needed — see [Connections](./connections.md) |

## Bottom panel

| Control | What it does |
|---|---|
| {{btn:server-environment:Environment Variables}} | Switch presets, edit variables, and load a workspace env file (`multimeter.mmt`) — see [Environment variables panel](../files/env/ui.md) |
| {{btn:history:History}} | Inspect recent requests and responses (method, URL, status, timing, bodies) — see [History](./history.md) |

## Status bar

While a test, suite, API, or mock is running, a badge appears on the **left** of the status bar (near the end of that group), for example {{btn:sync~spin:Running my-test.mmt}} or {{btn:server:Mock server http://localhost:8081}}.

| How it was started | Click the badge |
|---|---|
| Normal UI run (Run / Send / Run mock) | Opens the file |
| **Run in Core** (test/suite/API) | Menu: **Stop** or **Open file** |
| **Run in mock server panel** (or start from the Mock Server sidebar) | Menu: **Open mock server panel** or **Open file** |

There is no separate Stop control on the status bar. Stop a UI run from the editor panel; stop a panel mock from the Mock Server panel; use the status-bar menu only for **Run in Core**.

While a UI run or UI-started mock is active, Multimeter marks the tab dirty so closing it shows the usual Save / Don't Save / Cancel prompt — **Cancel** keeps the tab (and the run) open. Closing with Don't Save or Save stops UI-bound work. Mocks started from the Mock Server panel are not bound to the editor tab, so you can close the file while the server keeps running.

---

## See also

- [Getting Started](../quick-start.md) — install and a first API file
- [MMT Files](../files.md) — file types the editor and panels work with
- [Test](../files/test/index.md) · [Suite](../files/suite/index.md) · [Mock Server](../files/server/index.md)
