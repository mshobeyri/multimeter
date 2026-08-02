# Auth

### Auth
Use the `auth` field for built-in authentication. It generates the appropriate header (or query parameter) automatically. Explicit `headers.Authorization` always takes precedence.

#### Bearer token
```yaml
auth:
  type: bearer
  token: <<e:token>>
```
Generates: `Authorization: Bearer <resolved-token>`

#### Basic auth
```yaml
auth:
  type: basic
  username: <<e:user>>
  password: <<e:pass>>
```
Generates: `Authorization: Basic <base64(username:password)>`

#### API key (header)
```yaml
auth:
  type: api-key
  header: X-API-Key
  value: <<e:api_key>>
```
Generates: `X-API-Key: <resolved-value>`

#### API key (query parameter)
```yaml
auth:
  type: api-key
  query: api_key
  value: <<e:api_key>>
```
Appends `?api_key=<resolved-value>` to the query parameters.

#### OAuth 2.0 client credentials
```yaml
auth:
  type: oauth2
  grant: client_credentials
  token_url: https://auth.example.com/token
  client_id: <<e:client_id>>
  client_secret: <<e:client_secret>>
  scope: read write
```
At runtime, fetches an access token from `token_url` and sets `Authorization: Bearer <access_token>`.

Notes
- All `auth` field values support environment variables (`<<e:var>>`), inputs (`<<i:param>>`), and random tokens (`r:uuid`).
- Auth headers are masked in logs to prevent accidental credential exposure.
