# Generated Artifacts

### APIs
- Structure: `type: api`, title, method (HTTP only), url, format, inputs, body, examples. Protocol is optional (inferred from URL).
- Inputs: Use primitives or tokens (e.g., `name: r:first_name`). Place after title/description.
- WebSocket: `protocol: ws` (or use ws:// URL), body as sent message.

### Tests
- Structure: `type: test`, title, steps (call, assert, check).
- Layout: Sequential. Assertions: assert for fatal, check for non-fatal.

### Environments
- Structure: `type: env`, variables (api_url, etc.), presets.

### Docs
- Structure: `type: doc`, title, sources.
