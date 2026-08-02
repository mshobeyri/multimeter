# Mapping to Test Flow

Each HTTP request block becomes an inline `http` test step. Named requests become step ids, so later requests can refer to earlier results.

For example:

```http
# @name login
POST https://test.mmt.dev/echo
Content-Type: application/json

{"username":"ada"}
```

is treated like this Multimeter test step internally:

```yaml
- http: https://test.mmt.dev/echo
  id: login
  method: post
  format: json
  headers:
    Content-Type: application/json
  body:
    username: ada
  debug: true
```
