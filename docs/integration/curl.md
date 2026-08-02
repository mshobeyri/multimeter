# Curl

Import and run HTTP requests with curl in VS Code.

## Paste to convert

Paste a `curl ...` command into an API editor (YAML side). Multimeter detects it and converts the paste into `type: api` YAML you can edit and send.

## Run in Curl

For HTTP APIs in the tester, right-click {{btn:send:Send}} and choose **Run in Curl**. Multimeter builds a curl command from the current request (method, URL, headers, body, environment) and runs it in a **Multimeter Curl** terminal.

Available for HTTP only — not GraphQL, gRPC, or WebSocket.

See also: [Convertor](./convertor/index.md) · [HTTP](../files/api/protocols/http.md)
