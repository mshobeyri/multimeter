# Getting Started

Run a request against the public [test.mmt.dev](https://test.mmt.dev) server in under a minute.

## 1. Install

Install the [VS Code extension](./install.md) (or use the CLI only).

## 2. VS Code extension intro

After install, click the Multimeter activity icon in the VS Code sidebar. You get a custom `.mmt` editor plus panels, status-bar actions, and a gallery for new files.

[![VS Code extension intro](https://img.youtube.com/vi/dEbbsbPxqDc/hqdefault.jpg)](https://youtu.be/dEbbsbPxqDc)

### Panels

| Control | Where | What it does |
|---|---|---|
| {{btn:server:Mock Server}} | Activity bar | Start HTTP/HTTPS/WebSocket mocks, or load a `type: server` file |
| {{btn:plug:Connections}} | Activity bar | Watch active HTTP keep-alive and WebSocket sessions; close them when needed |
| {{btn:server-environment:Environment Variables}} | Bottom Multimeter panel | Switch presets, edit variables, and load a workspace env file (`multimeter.mmt`) |
| {{btn:history:History}} | Bottom Multimeter panel | Inspect recent requests and responses (method, URL, status, timing, bodies) |

See also: [History](./features/history.md)

### Status bar

- Click {{btn:file:Multimeter}} (status bar, right) — opens a new untitled `.mmt` file on the empty page
- While something is running, click {{btn:sync~spin:Stop}} (status bar, left) — stops the active test, suite, API run, or mock server

### Empty page (new `.mmt`)

When a file has no `type:` yet, Multimeter shows the empty page instead of the full editor:

1. **Select type** — click a type icon such as {{btn:symbol-method:API}} or {{btn:beaker:Test}} to write `type: …` and open that editor
2. **Gallery** — or click a sample card; it fills the file with a working snippet you can run immediately

## 3. Create an API file

Create `get_json.mmt`:

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

## 4. Send it

In VS Code, open the file and click {{btn:send:Send}}. The Response panel shows status, headers, and body.

With the CLI:

```sh
npx mmt-testlight run get_json.mmt
```

## 5. Try a test

Create `echo_test.mmt`:

```yaml
type: test
title: Simple HTTP test
description: Calls an HTTP endpoint directly and checks the response
steps:
  - http: https://test.mmt.dev/echo
    title: Send an echo request
    method: post
    body:
      message: hello world
    expect:
      status: 200
      body.body.message: hello world
```

Click {{btn:play:Run test}} — the Report panel shows whether checks passed.

## Next steps

- [Send an API request](./tasks/send-api-request.md) — inputs, outputs, and headers
- [Browse examples](/docs/examples) — copy a working folder
- [MMT Files](./files.md) — types, shared metadata, and layout
