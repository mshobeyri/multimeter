# Complete examples

HTTP and protocol samples. GraphQL/WS live under [Protocols](../../protocols/index.md) as well.

## HTTP
```yaml
 type: api
 title: Search users
 tags:
   - user
   - search
 description: Full-text search on users
 outputs:
  total: body[total]
 setenv:
  last_total: body[total]
 protocol: http
 url: <<e:api_url>>/users/search
 method: get
 format: json
 headers:
   Authorization: Bearer <<e:token>>
   X-Client: test
 query:
   q: john
   limit: "10"
 cookies:
   locale: en-US
```

## WS
```yaml
 type: api
 title: Notifications stream
 protocol: ws
 url: wss://example.com/ws
 format: json
 headers:
   X-Auth: e:token
 # Drive messages in a test using steps
```

## GraphQL
```yaml
 type: api
 title: Get Users
 tags:
   - user
   - graphql
 description: Fetch paginated users with their posts
 protocol: graphql
 url: <<e:api_url>>/graphql
 auth:
   type: bearer
   token: <<e:token>>
 inputs:
   limit:
     type: number
     default: 10
   offset:
     type: number
     default: 0
 outputs:
   userCount: body.data.users.length
   firstUser: body.data.users[0].name
 graphql:
   operation: |
     query GetUsers($limit: Int, $offset: Int) {
       users(limit: $limit, offset: $offset) {
         id
         name
         email
         posts { title }
       }
     }
   variables:
     limit: <<i:limit>>
     offset: <<i:offset>>
   operationName: GetUsers
 examples:
   - name: first-page
     inputs:
       limit: 5
       offset: 0
     outputs:
       userCount: 5
   - name: second-page
     inputs:
       limit: 5
       offset: 5
```

---
