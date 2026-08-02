# Supported Syntax

The first implementation targets the shared syntax used by VS Code REST Client and JetBrains HTTP Client:

```http
@host = https://test.mmt.dev
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
- File variables such as `@host = https://test.mmt.dev`.
- Variable references such as `{{host}}`.
- Common system variables such as `{{$guid}}`, `{{$uuid}}`, `{{$randomInt}}`, `{{$timestamp}}`, and `{{$datetime}}`.
- Request chaining such as `{{login.response.body.$.token}}`.
- Basic response status assertions from response handler scripts when they use `response.status === 200`.
