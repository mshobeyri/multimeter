# GraphQL

```yaml
 type: api
 protocol: graphql
 url: <<e:api_url>>/graphql
 auth:
   type: bearer
   token: <<e:token>>
 graphql:
   operation: |
     query GetUsers($limit: Int) {
       users(limit: $limit) { id name email }
     }
   variables:
     limit: 10
   operationName: GetUsers
 outputs:
   firstUser: body.data.users[0].name
```

Notes:
- `protocol: graphql` is required — it cannot be inferred from the URL
- The `graphql` block replaces `body`; `method` is always POST and `format` is always JSON
- Outputs are extracted from the standard `{ data, errors }` response shape
- If the response contains an `errors` array, the run is marked as failed

### graphql block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | string | Yes | The GraphQL query, mutation, or subscription string |
| `variables` | object | No | Variables passed to the operation |
| `operationName` | string | No | Selects a named operation when `operation` contains multiple |

### Inputs and outputs

Use `inputs` with `<<i:name>>` inside `graphql.variables`:

```yaml
 inputs:
   userId:
     type: number
     default: 1
 graphql:
   operation: |
     query GetUser($id: ID!) { user(id: $id) { name } }
   variables:
     id: <<i:userId>>
 outputs:
   userName: body.data.user.name
   hasErrors: body.errors
   statusCode: status
```

### What the graphql block replaces
- `body` — ignored; body is built from `graphql.operation` + `graphql.variables`
- `method` — always POST; `format` — always JSON
- `headers`, `auth`, `inputs`, `outputs`, `examples`, `setenv` — work like HTTP

See also: [HTTP](./http.md) · [Outputs](../outputs.md) · [Auth](../auth.md)
