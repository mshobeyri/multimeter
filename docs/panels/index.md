# Panels

Multimeter’s VS Code panels sit in the activity bar (left) and in the bottom Multimeter panel.

Click the Multimeter activity icon in the sidebar to open the activity-bar views. Environment and History live in the bottom panel area (`View → Open View…` or the Multimeter panel tab).

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

- While something is running, click {{btn:sync~spin:Stop}} (status bar, left) — stops the active test, suite, API run, or mock server

---

## See also

- [Getting Started](../quick-start.md) — install and a first API file
- [MMT Files](../files.md) — file types the editor and panels work with
