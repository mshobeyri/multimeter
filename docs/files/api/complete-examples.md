# Complete examples

HTTP and protocol samples. GraphQL/WS live under [Protocols](./protocols/index.md) as well.

## HTTP
```yaml
type: api
title: Get sample JSON
tags:
  - smoke
description: Fetch sample JSON from the public test server
outputs:
  slideshow: body.slideshow
protocol: http
url: https://test.mmt.dev/json
method: get
format: json
query:
  limit: "10"
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
