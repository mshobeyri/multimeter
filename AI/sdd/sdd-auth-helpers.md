# SDD: Authentication Helpers

## Summary

Add a first-class `auth` field to `type: api` files that generates the correct `Authorization` (or custom) header automatically. Supports Bearer token, Basic auth, API key, and a foundation for OAuth 2.0 client-credentials flow.

## Motivation

Currently, setting authentication requires manually constructing headers:

```yaml
# Current — verbose, error-prone, no validation
type: api
url: https://api.example.com/users
headers:
  Authorization: Bearer <<e:token>>
```

```yaml
# Current — Basic auth requires manual base64 (impossible without JS step)
type: api
url: https://api.example.com/users
headers:
  Authorization: Basic dXNlcjpwYXNz
```

Every major competitor (Postman, Insomnia, Bruno) provides a dedicated auth section. This is the #1 gap blocking adoption for teams evaluating Multimeter.

With `auth`:

```yaml
# New — declarative, validated, readable
type: api
url: https://api.example.com/users
auth:
  type: bearer
  token: <<e:token>>
```

```yaml
# New — Basic auth, auto-encoded
type: api
url: https://api.example.com/users
auth:
  type: basic
  username: <<e:user>>
  password: <<e:pass>>
```

## Syntax

### Bearer token

```yaml
auth:
  type: bearer
  token: <<e:token>>
```

Generates: `Authorization: Bearer <resolved-token>`

### Basic auth

```yaml
auth:
  type: basic
  username: <<e:user>>
  password: <<e:pass>>
```

Generates: `Authorization: Basic <base64(username:password)>`

### API key (header)

```yaml
auth:
  type: api-key
  header: X-API-Key
  value: <<e:api_key>>
```

Generates: `X-API-Key: <resolved-value>`

### API key (query parameter)

```yaml
auth:
  type: api-key
  query: api_key
  value: <<e:api_key>>
```

Appends `?api_key=<resolved-value>` to the URL query parameters.

### OAuth 2.0 client credentials

```yaml
auth:
  type: oauth2
  grant: client_credentials
  token_url: https://auth.example.com/token
  client_id: <<e:client_id>>
  client_secret: <<e:client_secret>>
  scope: read write
```

At runtime:
1. POST to `token_url` with `grant_type=client_credentials`, `client_id`, `client_secret`, `scope`.
2. Extract `access_token` from JSON response.
3. Set `Authorization: Bearer <access_token>`.

### No shorthand

`auth` is always an object with a `type` field. No string shorthand — keeps parsing unambiguous.

## Semantics

### Header precedence

1. Explicit `headers.Authorization` always wins (user override).
2. `auth`-generated header is set only if not already present in `headers`.
3. This matches the existing `setHeaderIfMissing` pattern in `networkCore.ts`.

### Environment variable substitution

All `auth` field values support the same token substitution as other fields:
- `<<e:var>>` — string interpolation
- `e:var` — type-preserving substitution
- `i:param` — input parameter
- `r:uuid` etc. — random values

### Validation

- If `auth.type` is not one of `bearer`, `basic`, `api-key`, `oauth2`, emit a parse error.
- `bearer` requires `token`.
- `basic` requires `username` and `password`.
- `api-key` requires `value` and exactly one of `header` or `query`.
- `oauth2` requires `grant`, `token_url`, `client_id`, `client_secret`.
- Unknown keys inside `auth` are reported as warnings (forward-compatible).

### Examples support

`auth` can be overridden per example:

```yaml
type: api
url: https://api.example.com/users
auth:
  type: bearer
  token: <<e:token>>

examples:
  - name: admin
    auth:
      type: bearer
      token: <<e:admin_token>>
  - name: no-auth
    auth: none
```

`auth: none` explicitly disables auth for that example.

### Logging

Auth headers are logged in the Request section like any other header, but the value is masked:
- Bearer: `Authorization: Bearer ****<last4>`
- Basic: `Authorization: Basic ****`
- API key: `X-API-Key: ****<last4>`

This prevents accidental credential exposure in logs, history, and reports.

### Documentation generation

`type: doc` includes auth requirements in generated HTML/Markdown:
- Shows the auth type and required parameters.
- Does not render actual token values.

## Changes

### 1. `core/src/APIData.ts`

Add auth types and field to `APIData`:

```typescript
export type AuthType = 'bearer' | 'basic' | 'api-key' | 'oauth2';

export interface AuthBearer {
  type: 'bearer';
  token: string;
}

export interface AuthBasic {
  type: 'basic';
  username: string;
  password: string;
}

export interface AuthApiKey {
  type: 'api-key';
  header?: string;
  query?: string;
  value: string;
}

export interface AuthOAuth2 {
  type: 'oauth2';
  grant: 'client_credentials';
  token_url: string;
  client_id: string;
  client_secret: string;
  scope?: string;
}

export type AuthConfig = AuthBearer | AuthBasic | AuthApiKey | AuthOAuth2 | 'none';
```

Add to `APIData`:

```typescript
export interface APIData extends MMTFile {
  // ... existing fields ...
  auth?: AuthConfig;
}
```

Add to `ExampleData`:

```typescript
export interface ExampleData {
  // ... existing fields ...
  auth?: AuthConfig;
}
```

### 2. `core/src/apiParsePack.ts`

- Add `'auth'` to `VALID_API_ROOT_KEYS`.
- Parse `auth` field in `yamlToAPI` and `yamlToAPIStrict`.
- Add `validateAuth(auth: any): AuthConfig` — validates type, required fields, and value types.
- Report parse errors for invalid auth configurations.

### 3. `core/src/JSerAPI.ts`

This is the key change. After building headers from `APIData.headers`, inject auth header construction:

```typescript
function authToJS(auth: AuthConfig): string {
  if (auth === 'none') {
    return '';
  }
  switch (auth.type) {
    case 'bearer':
      return `if (!headers["Authorization"]) { headers["Authorization"] = "Bearer " + ${toTemplateWithEnvs(auth.token)}; }`;
    case 'basic': {
      return `if (!headers["Authorization"]) { headers["Authorization"] = "Basic " + btoa(${toTemplateWithEnvs(auth.username)} + ":" + ${toTemplateWithEnvs(auth.password)}); }`;
    }
    case 'api-key':
      if (auth.header) {
        return `if (!headers[${JSON.stringify(auth.header)}]) { headers[${JSON.stringify(auth.header)}] = ${toTemplateWithEnvs(auth.value)}; }`;
      }
      // query variant handled in URL building
      return '';
    case 'oauth2':
      // Generates code that calls the token endpoint at runtime
      return generateOAuth2JS(auth);
  }
}
```

For OAuth2, generate an async fetch to the token URL before the main request:

```typescript
function generateOAuth2JS(auth: AuthOAuth2): string {
  return `
    if (!headers["Authorization"]) {
      const _tokenResp = await send_({
        url: ${toTemplateWithEnvs(auth.token_url)},
        method: "post",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: ${toTemplateWithEnvs(auth.client_id)},
          client_secret: ${toTemplateWithEnvs(auth.client_secret)},
          ${auth.scope ? `scope: ${toTemplateWithEnvs(auth.scope)},` : ''}
        }).toString()
      });
      const _tokenData = JSON.parse(_tokenResp.body);
      headers["Authorization"] = "Bearer " + _tokenData.access_token;
    }`;
}
```

Insert generated auth code after header assignment, before the `send_()` call.

### 4. `core/src/apiParsePack.ts` — API key query variant

When `auth.type === 'api-key'` and `auth.query` is set, append to the query parameters during JS generation rather than headers.

### 5. `core/src/runner.ts`

No changes needed. Auth is resolved entirely during JS generation. The runner just executes the generated code.

### 6. `core/src/networkCore.ts`

No changes needed. Auth headers arrive as normal headers. The existing `setHeaderIfMissing` pattern handles precedence correctly.

### 7. `core/src/logHelpers.ts` (or equivalent logging)

Add auth value masking for log output:
- Detect `Authorization` header and mask the value.
- Detect known API key headers from `auth.header` and mask.
- Pattern: show type prefix + last 4 chars. E.g., `Bearer ****ab3f`.

### 8. `mmtview/src/text/Schema.tsx`

Add `auth` to the API schema with sub-properties for each type. The UI form shows:
- Type dropdown: Bearer, Basic, API Key, OAuth 2.0
- Type-specific fields rendered dynamically

### 9. `mmtview/src/text/AutoComplete.tsx`

Add `auth` to root-level API siblings with auto-complete for:
- `auth:` → expands to type selection
- `type: bearer` → suggests `token:`
- `type: basic` → suggests `username:`, `password:`
- `type: api-key` → suggests `header:`, `query:`, `value:`
- `type: oauth2` → suggests `grant:`, `token_url:`, `client_id:`, `client_secret:`, `scope:`

### 10. `mmtview/src/api/` — UI panel

Add an Auth section to the API UI editor (between Headers and Body):
- Dropdown for auth type (None, Bearer, Basic, API Key, OAuth 2.0)
- Dynamic fields based on selection
- "None" hides the section content

### 11. `core/src/postmanConvertor.ts`

Map Postman auth types to `auth` field during conversion:
- `bearer` → `{ type: 'bearer', token }`
- `basic` → `{ type: 'basic', username, password }`
- `apikey` → `{ type: 'api-key', header/query, value }`
- `oauth2` → `{ type: 'oauth2', ... }` (if client-credentials)

### 12. `core/src/openapiConvertor.ts`

Map OpenAPI security schemes to `auth` field:
- `http/bearer` → `{ type: 'bearer', token: 'i:token' }`
- `http/basic` → `{ type: 'basic', username: 'i:username', password: 'i:password' }`
- `apiKey` → `{ type: 'api-key', header/query, value: 'i:api_key' }`
- `oauth2/clientCredentials` → `{ type: 'oauth2', ... }`

### 13. `core/src/docParsePack.ts` / `docHtml.ts` / `docMarkdown.ts`

Render auth requirements in generated documentation:
- Show auth type badge (Bearer, Basic, API Key, OAuth2)
- List required auth parameters
- Do not render actual values

### 14. `docs/api-mmt.md`

Add `auth` section with examples for each type. Place after `headers` section.

### 15. `core/src/JSer.test.ts`

- Test: `auth.type: bearer` generates correct Authorization header.
- Test: `auth.type: basic` generates base64-encoded header.
- Test: `auth.type: api-key` with `header` generates custom header.
- Test: `auth.type: api-key` with `query` appends query parameter.
- Test: `auth.type: oauth2` generates token fetch + header.
- Test: explicit `headers.Authorization` overrides `auth` field.
- Test: `auth: none` in example disables inherited auth.
- Test: env variable substitution works in all auth fields.
- Test: invalid auth type produces parse error.
- Test: missing required auth fields produce parse errors.

## Rollout

### Phase 1 — Bearer, Basic, API Key (low effort)
- Data model, parsing, JS generation, validation, tests
- No network changes needed
- Covers ~80% of API auth use cases

### Phase 2 — OAuth 2.0 client credentials
- Adds async token fetch in generated code
- Requires `send_()` to be available in the generated JS context (already is)
- Token caching not included in Phase 1 (each run fetches fresh)

### Phase 3 — UI, converters, docs
- Webview auth editor panel
- Postman/OpenAPI converter mapping
- Documentation generation
- Log masking

### Future
- OAuth 2.0 authorization code flow (requires browser redirect — complex)
- Digest auth
- AWS Signature v4
- Token caching / refresh across calls within a test
- Auth inheritance (env-level auth applied to all APIs)
