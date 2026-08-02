# Using Mock Servers in Suites

Use the top-level `servers:` field to list mock server files that should start **before** any tests and remain running for the entire suite duration. They are stopped automatically when the suite finishes.

### Example

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

### Execution flow

1. All files listed under `servers:` start before any tests
2. Tests begin once servers are ready
3. When the suite finishes, all servers are stopped automatically

You can also include `type: server` files directly in the `items` array for inline control over when they start relative to other stages.

This lets you set up complex integration environments declaratively, without manual server management.

---
