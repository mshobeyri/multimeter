# Sources and precedence

Preferred sources in order:
1) OpenAPI (3.x)
2) Postman (v2.x)
3) Free-form description

Other specs (e.g., GraphQL, RAML) not supported; REST APIs only. Tools should attempt discovery using common filenames (openapi.yaml/yml/json, swagger.yaml) and `postman/*.json`.
