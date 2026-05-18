# HTTP Files

Multimeter can open `.http` and `.https` files as test flows. This is intended for compatibility with common HTTP-client files while still running through Multimeter's normal test runner, reporting, environment handling, and suite execution.

Multimeter does not take ownership of `.http` files by default. In VS Code, use **Open With...** and choose **Multimeter HTTP Test Editor** when you want to run a `.http` file with Multimeter.

You can also import `.http` and `.https` files from `type: test` `.mmt` files. Multimeter converts the HTTP file to a test flow internally, so the alias can be used with a normal `call` step.

## Supported Syntax

The first implementation targets the shared syntax used by VS Code REST Client and JetBrains HTTP Client:

```http
@host = https://api.example.com
@username = ada

###
# @name login
POST {{host}}/login
Content-Type: application/json

{
  "username": "{{username}}"
}

###
# @name profile
GET {{host}}/me
Authorization: Bearer {{login.response.body.$.token}}
```

Supported request features:

- Request separators with `###`.
- Request names with `# @name` or `// @name`.
- `METHOD URL` request lines, plus `HTTP/1.1` and `HTTP/2` suffixes.
- Headers and raw request bodies.
- JSON, XML, and text body detection.
- File variables such as `@host = https://api.example.com`.
- Variable references such as `{{host}}`.
- Common system variables such as `{{$guid}}`, `{{$uuid}}`, `{{$randomInt}}`, `{{$timestamp}}`, and `{{$datetime}}`.
- Request chaining such as `{{login.response.body.$.token}}`.
- Basic response status assertions from response handler scripts when they use `response.status === 200`.

## Mapping to Test Flow

Each HTTP request block becomes an inline `http` test step. Named requests become step ids, so later requests can refer to earlier results.

For example:

```http
# @name login
POST https://api.example.com/login
Content-Type: application/json

{"username":"ada"}
```

is treated like this Multimeter test step internally:

```yaml
- http: https://api.example.com/login
  id: login
  method: post
  format: json
  headers:
    Content-Type: application/json
  body:
    username: ada
```

## Saving

The Multimeter HTTP Test Editor shows `.http` and `.https` files as runnable test flows, but the structured UI is read-only for HTTP files. Multimeter does not rewrite `.http` files from the flow editor, so it avoids interfering with other REST Client or JetBrains HTTP Client tooling.

Use **Save as MMT** from the HTTP Test Editor to create an editable `.mmt` test file from the parsed HTTP requests. The generated `.mmt` file can then be edited with Multimeter's normal test UI.

You can still edit the raw `.http` source text directly when the file is opened as text.

## Current Limitations

These constructs are recognized or preserved, but are not fully executed natively yet:

- Pre-request scripts.
- Full response handler/test script execution.
- Multipart/form-data as structured parts.
- Request body file includes such as `< ./payload.json`.
- Cookie jar directives and redirect-control directives.
- Digest auth, AWS SigV4, and other tool-specific auth helpers.

Use Multimeter YAML `.mmt` files when you need full flow control, data-driven loops, explicit checks/asserts, report configuration, mock servers, load tests, or advanced environment presets.
