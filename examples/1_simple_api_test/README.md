# Simple API Test

Basic examples of `.mmt` API files using the [test.mmt.dev](https://test.mmt.dev) public test server.

## Files

| File | Description |
|---|---|
| `get_json.mmt` | Simple GET request that returns a sample JSON payload |
| `post_echo_yaml_body.mmt` | POST request with a YAML object body (auto-serialized to JSON) |
| `post_echo_plain_body.mmt` | POST request with a raw JSON string body |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. Click **Run** in the editor to execute the API call.
3. View the response in the output panel.

### With the CLI

```sh
npx testlight run examples/1_simple_api_test/get_json.mmt
npx testlight run examples/1_simple_api_test/post_echo_yaml_body.mmt
npx testlight run examples/1_simple_api_test/post_echo_plain_body.mmt
```

## What these hit

All requests go to `https://test.mmt.dev`, a public HTTP test server with endpoints for status codes, delays, echo, auth, and more. See the full endpoint list at [test.mmt.dev](https://test.mmt.dev/).

## Next steps

- See [2_api_environment_variables/](../2_api_environment_variables/) for using environment variables and presets.
- See [API docs](../../docs/api-mmt.md) for the full `.mmt` API reference.
- See [Test docs](../../docs/test-mmt.md) for building test flows with assertions.
