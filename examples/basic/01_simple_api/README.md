# Simple API

Basic `type: api` examples using one GET request and simple POST requests against the [test.mmt.dev](https://test.mmt.dev) public test server.

## Files

| File | Description |
|---|---|
| `get_json.mmt` | Simple GET request that returns a sample JSON payload |
| `post_echo_yaml_body.mmt` | Simple POST request with a YAML object body, serialized to JSON |
| `post_echo_json_body.mmt` | Simple POST request with a raw JSON body |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. Click **Run** in the editor to execute the API call.
3. View the response in the output panel.

### With the CLI

```sh
npx testlight run examples/basic/01_simple_api/get_json.mmt
npx testlight run examples/basic/01_simple_api/post_echo_yaml_body.mmt
npx testlight run examples/basic/01_simple_api/post_echo_json_body.mmt
```

## What these hit

All requests go to `https://test.mmt.dev`, a public HTTP test server with endpoints for status codes, delays, echo, auth, and more.

## Next steps

- See [Simple Test](../02_simple_test/) for a direct HTTP test.
- See [Environment Variables](../03_environment_variables/) for using variables without editing API files.
- See [API Authentication](../../intermediate/17_api_authentication/) for Basic, Bearer, and API key auth examples.
- See [API docs](../../../docs/files/api.md) for the full `.mmt` API reference.
