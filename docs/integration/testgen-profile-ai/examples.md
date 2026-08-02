# Examples

From OpenAPI `/users` POST:
- API: `type: api\ntitle: Create User\nprotocol: http\nmethod: post\nurl: https://test.mmt.dev/echo\ninputs:\n  name: r:firstName\n  email: r:email\nbody:\n  name: i:name\n  email: i:email\nexamples:\n  - name: Valid User\n    inputs:\n      name: "John"\n      email: "john@example.com"\n`
- Test: `type: test\ntitle: Create User Test\nsteps:\n  - call: users-api\n    inputs:\n      name: "Test User"\n      email: "test@example.com"\n  - assert: status == 201\n  - check: response.id != null\n`
- Env: `type: env\nvariables:\n  api_url:\n    local: http://localhost:8080\n    prod: https://test.mmt.dev\n`

For WebSocket: `type: api\nprotocol: ws\nurl: wss://ws.example.com/chat\ninputs:\n  greeting: "Hello"\nbody: i:greeting\n`
