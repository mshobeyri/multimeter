# Quick Start

Run a request against the public [test.mmt.dev](https://test.mmt.dev) server in under a minute.

## 1. Install

Install the [VS Code extension](./install.md) (or use the CLI only).

## 2. Create an API file

Create `get_json.mmt`:

```yaml
type: api
title: Get sample JSON
url: https://test.mmt.dev/json
method: get
format: json
```

## 3. Send it

In VS Code, open the file and click **Send** (or **Run**). The Response panel shows status, headers, and body.

With the CLI:

```sh
npx mmt-testlight run get_json.mmt
```

## 4. Try a test

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
