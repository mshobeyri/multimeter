# run

Start an imported mock server. The server runs for the duration of the test and stops automatically when the test finishes.

```yaml
type: test
title: Test with Mock Server
import:
  mockApi: ./mocks/user-service.mmt   # type: server file
  userApi: ./apis/user.mmt
steps:
  - run: mockApi                       # starts the mock server
  - call: userApi
    id: getUsers
  - assert: ${getUsers.status} == 200
```

**Behavior:**
- If the server is already running, `run` does nothing (idempotent)
- All servers started by `run` stop automatically when the test finishes
- If the port is already in use, the test fails with an error

Use this to make tests self-contained — no need to manually start servers before running.

For validating call outputs inline, see [Inline expect and debug](./run-expect.md).

Next: [Inline expect](./run-expect.md) · [check](./check.md) · [assert](./assert.md) · [Mock servers in tests](../../server/in-tests.md)
