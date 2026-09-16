# In tests

Start mock servers directly from tests using the `run` step — tests stay self-contained with no manual server startup.

```yaml
type: test
title: Test with Mock Server
import:
  mockApi: ./mocks/user-service.mmt
  userApi: ./apis/user.mmt
steps:
  - run: mockApi                # starts the mock server
  - call: userApi
    id: getUsers
  - assert: ${getUsers.status} == 200
```

### Behavior

- If the server is already running, `run` does nothing (idempotent)
- Servers join the same public running-server list used by suites. They stop when the **outermost** run finishes (this test, or the enclosing suite / load test)
- If the port is already in use by another process, the test fails with an error

In the Flow panel, click **Add item** → **Server** to pick from imported server files. See [run step](../test/steps/run.md) for full details.

Example: [Simple mock server](../../../examples/intermediate/18_simple_mock_server/README.md)

---

See also: [Mock Server overview](./index.md) · [In suites](./in-suites.md) · [CLI](./cli.md)
