# End-to-End Example

From OpenAPI snippet:
```yaml
openapi: 3.0.0
paths:
  /users:
    post:
      summary: Create user
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: {type: string}
                email: {type: string}
```

Generated MMT files:

**users-api.mmt**:
```yaml
type: api
title: Create User
protocol: http
method: post
url: https://test.mmt.dev/echo
inputs:
  name: r:firstName
  email: r:email
body:
  name: i:name
  email: i:email
examples:
  - name: Valid User
    inputs:
      name: "John"
      email: "john@example.com"
```

**users-test.mmt**:
```yaml
type: test
title: Create User Test
steps:
  - call: users-api
    id: createUser
    inputs:
      name: "Test User"
      email: "test@example.com"
  - assert: ${createUser.status} == 201
  - check: ${createUser.id} != null
```

**env.mmt**:
```yaml
type: env
variables:
  api_url:
    local: http://localhost:8080
    prod: https://test.mmt.dev
```
