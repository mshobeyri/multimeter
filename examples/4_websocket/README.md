# WebSocket Example

This example shows how to define **WebSocket APIs** with inputs and outputs in `.mmt` files, and how to test them in a flow.

## Files

| File | Description |
|---|---|
| `ws_echo.mmt` | Send a text message to a WS echo server and capture the reply |
| `ws_json_echo.mmt` | Send a JSON object over WS with inputs, extract fields from the echoed response |
| `ws_test.mmt` | Test flow that calls both WS APIs and verifies echoed values |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. Click **Run** to connect, send, and see the response.
3. Change input values before running to send different messages.

### With the CLI

```sh
npx testlight run examples/4_websocket/ws_echo.mmt
npx testlight run examples/4_websocket/ws_json_echo.mmt
npx testlight run examples/4_websocket/ws_test.mmt
```

Override inputs:

```sh
npx testlight run examples/4_websocket/ws_echo.mmt -e greeting="Hi there"
```

## Key concepts

- **`protocol: ws`** — use WebSocket instead of HTTP. Also inferred automatically from `ws://` or `wss://` URLs.
- **`body`** — the message sent to the server. Can be a string or JSON object.
- **`inputs`** — parameterize the message content with `i:name`.
- **`outputs`** — extract fields from the server's reply using `body[field]` bracket paths.
- **`format: json`** — parse the reply as JSON so bracket-path outputs work.
- No `method` field is needed for WebSocket APIs.

See [API docs](../../docs/api-mmt.md#websocket) for full details.
