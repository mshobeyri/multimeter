# Suite quick start

Minimal suite that runs two tests in sequence:

```yaml
type: suite
title: Simple Suite
items:
  - test/echo_test.mmt
  - then
  - test/status_test.mmt
```

Open the file in VS Code to get the **suite panel** on the right. Click {{btn:play:Run suite}} to run all items. Items between `then` separators run in parallel; stages run sequentially.

More: [Edit Suite](./edit.md) · [items](./items.md) · [Reports](./reports.md) · [Exports](./exports.md) · [Execution](./execution.md) · [CLI](./cli.md)
