# run

Start an imported mock server. The server joins the public running-server list: if this test is the outermost run, it stops when the test finishes; if the test is inside a suite or load test, it stays up until that outer run finishes.

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
- Servers join the same public running-server list used by suites. They stop when the **outermost** run finishes (this test, or the enclosing suite / load test)
- If the port is already in use by another process, the test fails with an error

Use this to make tests self-contained — no need to manually start servers before running.

For validating call outputs inline, see [Inline expect, require, and debug](./run-expect.md).

Next: [Inline expect](./run-expect.md) · [check](./check.md) · [assert](./assert.md) · [Mock servers in tests](../../server/in-tests.md)
