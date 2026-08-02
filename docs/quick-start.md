# Quick Start

Run a request against the public [test.mmt.dev](https://test.mmt.dev) server in under a minute.

## 1. Install

Install the [VS Code extension](./install.md) (or use the CLI only).

## 2. VS Code extension intro

After install, open the Multimeter activity icon in the VS Code sidebar. You get a custom `.mmt` editor plus panels, status-bar actions, and a starter gallery for new files.

[![VS Code extension intro](https://img.youtube.com/vi/dEbbsbPxqDc/hqdefault.jpg)](https://youtu.be/dEbbsbPxqDc)

### Panels

| Panel | Where | What it does |
|---|---|---|
| **Mock Server** | Activity bar | Start HTTP/HTTPS/WebSocket mocks, or load a `type: server` file |
| **Connections** | Activity bar | Watch active HTTP keep-alive and WebSocket sessions; close them when needed |
| **Environment Variables** | Bottom Multimeter panel | Switch presets, edit variables, and load a workspace env file (`multimeter.mmt`) |
| **History** | Bottom Multimeter panel | Inspect recent requests and responses (method, URL, status, timing, bodies) |

### Status bar icons

- **Multimeter logo** (right) — opens a new untitled `.mmt` file on the no-type starter page
- **Active run** (left, spinning) — appears while a test, suite, API run, or mock server is active; click it to stop

### No-type page (new `.mmt`)

When a file has no `type:` yet, Multimeter shows the starter page instead of the full editor:

1. **Select type** — pick API, Test, Environment, Suite, Doc, Server, Load Test, or Report to write `type: …` and open that editor
2. **Gallery** — or choose a ready sample card; it fills the file with a working snippet you can Send/Run immediately

Each gallery card also links to docs and demos for that file type.

Related workflows (commands / docs):

- **Convertor** — import OpenAPI or Postman into `.mmt` ([Convertor](./integration/convertor/index.md))
- **Certificates** — TLS/mTLS settings live with your env file ([Certificates](./features/certificates/index.md))

Inside an open typed `.mmt` file you also use the editor chrome: **Send** / **Run**, Response, Log, and (for suites) the suite tree.


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

In VS Code, open the file and click **Send** (or **Run**). The Response panel shows status, headers, and body.

With the CLI:

```sh
npx mmt-testlight run get_json.mmt
```

## 5. Try a test

Create `echo_test.mmt`:

```yaml
type: test
title: Echo POST
steps:
  - http:
      url: https://test.mmt.dev/post
      method: post
      format: json
      body:
        hello: world
  - expect:
      status: 200
      body.json.hello: world
```

Click **Run** — the Log panel shows whether checks passed.

## Next steps

- [Send an API request](./tasks/send-api-request.md) — inputs, outputs, and headers
- [Browse examples](/docs/examples) — copy a working folder
- [Files overview](./files.md) — all `.mmt` types
- [MMT Files](./files.md) — types, shared metadata, and layout
