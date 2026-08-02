# Using Mock Servers in Tests

You can start mock servers directly from your tests using the `run` step. This makes tests self-contained — no need to manually start servers before running.

### Import and run

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
- All servers started by `run` stop automatically when the test finishes
- If the port is already in use by another process, the test fails with an error

### Adding a server step in the UI

In the Flow panel, click **Add item** and select **Server**. A box appears where you can choose from your imported server files.

Example: [Simple mock server](../../../examples/intermediate/18_simple_mock_server/README.md)

---
