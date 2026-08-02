# In suites

Use the top-level `servers:` field to list mock server files that start **before** any tests and remain running for the entire suite. They stop automatically when the suite finishes.

```yaml
type: suite
title: Integration Suite
servers:
  - mocks/user-service.mmt
  - mocks/auth-service.mmt
items:
  - tests/login.mmt
  - tests/profile.mmt
```

You can also include `type: server` files directly in `items` for inline control over when they start relative to other stages.

For execution flow, partial runs, and the `servers` root-only rule, see [Suite execution](../suite/execution.md#mock-servers-in-suites).

---

See also: [Mock Server overview](./index.md) · [In tests](./in-tests.md) · [CLI](./cli.md)
