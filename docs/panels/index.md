# Panels

Multimeter’s VS Code panels sit in the activity bar (left). The bottom Multimeter panel is a **Views** drop target for relocating those same panels.

Click the Multimeter activity icon in the sidebar to open the views.

## Views dock

Both the Multimeter sidebar and the bottom Multimeter panel have a **Views** tree. It keeps a real drop target so you can relocate or tab-merge Multimeter panels. Webview-only containers (especially a lone Environment or History tab in the bottom panel) hide the drop overlay — a [VS Code limitation](https://github.com/microsoft/vscode/issues/144122).

1. Drag a view’s title onto the **Views** header (or use the view’s context menu → **Move View**).
2. To tab-merge two views, drag one title onto the other view’s title (works in the Multimeter sidebar).
3. If Environment or History is stuck as its own panel tab with no drop area, run **Multimeter: Group Environment & History in Sidebar** (or **… in Panel**), or use the links on the **Views** welcome screen.
4. Click a row in **Views** to focus that panel again.

Listed views: Temp Files, Get Started, Mock Server, Connections, Cache, Environment Variables, and History.

## Activity bar

| Control | What it does |
|---|---|
| {{btn:file:Temp Files}} | Scratch `.mmt` drafts you can pin, archive, or save later — see [Temp Files](./temp-files.md) |
| {{btn:rocket:Get Started}} | First-request walkthrough (create a POST, send, change the body) — see [Get Started](./get-started.md) |
| {{btn:server:Mock Server}} | Start HTTP/HTTPS/WebSocket mocks, or load a `type: server` file — see [Mock server panel](../files/server/panel.md) |
| {{btn:plug:Connections}} | Watch active HTTP keep-alive and WebSocket sessions; close them when needed — see [Connections](./connections.md) |
| {{btn:database:Cache}} | Watch in-run `cache:` entries (test call + live env); empties when the run ends — see [Cache](./cache.md) |
| {{btn:server-environment:Environment Variables}} | Switch presets, edit variables, and load a workspace env file (`multimeter.mmt`) — see [Environment variables panel](../files/env/ui.md) |
| {{btn:history:History}} | Inspect recent requests and responses (method, URL, status, timing, bodies) — see [History](./history.md) |

## Bottom panel

The Multimeter bottom panel starts with a **Views** dock only. Drag Environment, History, or other Multimeter views onto that header to park them in the bottom panel. Use **Multimeter: Group Environment & History in Panel** to move both there at once.

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
- [Cache](./cache.md) · [Connections](./connections.md)
- [Test](../files/test/index.md) · [Suite](../files/suite/index.md) · [Mock Server](../files/server/index.md)
