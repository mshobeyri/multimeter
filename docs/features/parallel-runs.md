# Parallel runs

Independent work in a test or suite can run at the same time instead of one request after another. The same rules apply in VS Code and in [Testlight](./testlight/index.md).

**Tests.** `stages:` start together. Use `after` when one stage must wait. A flat `steps:` list still runs in order. See [Test stages](../files/test/stages/index.md).

**Suites.** Files listed together run at the same time. Put `then` between sections when the next group must wait. See [Suite execution](../files/suite/execution.md).

```yaml
type: suite
title: Users and orders in parallel
items:
  - tests/users.mmt
  - tests/orders.mmt
  - then
  - tests/report.mmt
```

`users.mmt` and `orders.mmt` start together. After both finish, `report.mmt` runs. There is no extra flag: two items with a `then` after them are one parallel section.

See also: [Call cache](./call-cache.md) · [Write a test flow](../tasks/write-test-flow.md) · [Run a suite](../tasks/run-suite.md)
