# Supported Bruno Syntax

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
  baseUrl: https://test.mmt.dev
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
