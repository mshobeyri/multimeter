# WebSocket

Use `protocol: ws` (or a `ws://` / `wss://` URL) for bidirectional messaging.

```yaml
 type: api
 protocol: ws
 url: ws://localhost:8080/ws
 format: json
 headers:
   X-Auth: e:token
 # drive messages in tests via call steps
```
Tip: For WS, use tests to send/receive frames with `call` steps that invoke this API.


## Complete example

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


Tip: drive frames from [test `call` steps](../files/test/call.md). Live sessions also appear in the Connections panel.
