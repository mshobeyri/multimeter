# Bruno Files

Multimeter can open Bruno `.bru` request files as runnable test flows. This is intended for teams migrating from Bruno or reusing existing Bruno requests while still running through Multimeter's normal test runner, reporting, environment handling, and suite execution.

Multimeter does not take ownership of `.bru` files by default. In VS Code, use **Open With...** and choose **Multimeter Bruno Test Editor** when you want to run a Bruno request with Multimeter.

You can also import `.bru` files from `type: test` `.mmt` files. Multimeter converts each Bruno request file to a test flow internally, so the alias can be used with a normal `call` step.

```yaml
type: test
title: Reuse Bruno request
import:
  profile: requests/get_profile.bru
steps:
  - call: profile
```

## Supported Bruno Syntax

Multimeter supports the common single-request `.bru` structure:

```bru
meta {
  name: Get Profile
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/me
  body: none
  auth: bearer
}

vars:pre-request {
  baseUrl: https://api.example.com
}

headers {
  Accept: application/json
}

auth:bearer {
  token: {{token}}
}

params:query {
  trace: {{$uuid}}
}

tests {
  expect(res.status).to.equal(200);
}
```

Supported pieces:

- `meta.name` becomes the test title and request id.
- HTTP method blocks: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `trace`.
- `url`, `body`, and `auth` from the method block.
- `headers` and `params:query` key/value blocks.
- `body:json`, `body:xml`, and `body:text` blocks.
- `auth:bearer` tokens are converted to an `Authorization: Bearer ...` header.
- `vars:*` blocks before the response are used for local variable substitution.
- `{{name}}` variables resolve from local Bruno vars first, then to Multimeter environment tokens like `<<e:name>>`.
- Common random variables such as `{{$uuid}}` map to Multimeter random tokens.
- Simple Bruno assertions like `expect(res.status).to.equal(200)` and `expect(res.body.name).to.equal("Ada")` become Multimeter `expect` checks.

## Editing And Saving

The Multimeter Bruno Test Editor shows `.bru` files as runnable test flows, but the structured UI is read-only for Bruno files. Multimeter does not rewrite `.bru` files from the flow editor, so it avoids interfering with Bruno tooling.

Use **Save as MMT** from the Bruno Test Editor to create an editable `.mmt` test file from the parsed Bruno request. The generated `.mmt` file can then be edited with Multimeter's normal test UI.

You can still edit the raw `.bru` source text directly when the file is opened as text.

## Current Limitations

- Bruno collection folders are not expanded automatically; import or open individual `.bru` request files.
- Pre-request and post-response scripts are not executed as Bruno scripts. Only simple `expect(...).to.equal(...)` style tests are mapped to Multimeter checks.
- File bodies, multipart helpers, and advanced auth helpers may need conversion to editable `.mmt` for full control.
