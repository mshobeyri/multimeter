# Mock Server quick start

Minimal mock server with a health endpoint:

```yaml
type: server
title: Sample Mock Server
port: 9099
cors: true
endpoints:
  - method: get
    path: /health
    status: 200
    format: json
    body:
      status: ok
```

Open the file in VS Code and click {{btn:play:Run mock}} in the run view. Point your client or test at `http://localhost:9099/health`.

More: [Edit Mock](./edit.md) · [Mock server panel](./panel.md) · [In tests](./in-tests.md) · [CLI](./cli.md)
