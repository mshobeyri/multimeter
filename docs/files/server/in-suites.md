# In suites

Use the top-level `servers:` field to list mock server files that start at the **beginning of that suite**, before `items`. They are registered on the suite’s public running-server list and stay up until the outermost suite finishes. Nested suites use the same field: when that nested suite starts, its `servers:` start then (or skip if already running).

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

You can also include `type: server` files directly in `items` so they start **at that item’s position** (after earlier `then` stages; before other files in the same stage). Do not list the same server in both `servers:` and `items:` of one suite file — the editor underlines that as an error. The same server in a nested suite is allowed.

For execution flow and partial runs, see [Suite execution](../suite/execution.md#mock-servers-in-suites).

---

See also: [Mock Server overview](./index.md) · [In tests](./in-tests.md) · [CLI](./cli.md)
