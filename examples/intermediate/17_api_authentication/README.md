# API Authentication

Examples of `type: api` files that add authentication to requests.

## Files

| File | Description |
|---|---|
| `get_with_basic_auth.mmt` | Sends a GET request with Basic username/password authentication |
| `get_with_bearer_auth.mmt` | Sends a GET request with a Bearer token |
| `get_with_apikey_auth.mmt` | Sends a GET request with an API key in a custom header |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. Click **Run** in the editor to execute the API call.
3. Inspect the request headers in the output panel.

### With the CLI

```sh
npx testlight run examples/intermediate/17_api_authentication/get_with_basic_auth.mmt
npx testlight run examples/intermediate/17_api_authentication/get_with_bearer_auth.mmt
npx testlight run examples/intermediate/17_api_authentication/get_with_apikey_auth.mmt
```

## Key concepts

- **Basic auth** sends a username and password as an Authorization header.
- **Bearer auth** sends a token as an Authorization header.
- **API key auth** sends a configured key in a configured header.

See [API docs](../../../docs/api-mmt.md) for the full `.mmt` API reference.
