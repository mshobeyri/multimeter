# Execution

## Sequential and Parallel Execution
By default, all items listed in the `items` array will run in parallel. To control the flow and run items in sequential stages, use `then` to separate groups. All items between `then` separators form a group that runs in parallel. The groups themselves run sequentially, one after the other.

```yaml
type: suite
title: Sequential and Parallel Execution Example
items:
  - test1.mmt
  - test2.mmt
  - then
  - test3.mmt
  - test4.mmt
  - then
  - test5.mmt
```

In the example above, the execution flow is as follows:
1. `test1.mmt` and `test2.mmt` start running in parallel.
2. The suite waits for both `test1.mmt` and `test2.mmt` to complete.
3. `test3.mmt` and `test4.mmt` start running in parallel.
4. The suite waits for both `test3.mmt` and `test4.mmt` to complete.
5. `test5.mmt` is run.

## Mock Servers in Suites

#### Suite-level servers (`servers:` field)

Use the top-level `servers:` field to list mock server files that should start **before** any tests and remain running for the **entire** suite duration. They are stopped automatically when the suite finishes.

> **Note:** `servers` is a **root-only** field — it only takes effect when the suite is run directly. If Suite A imports Suite B, Suite B's `servers` field is ignored. Servers should be declared in the root suite to avoid conflicts.

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

This is the recommended way to manage mock servers in suites. It is safe even when the same test file appears multiple times, or when multiple tests use the same server — the server is started once and kept alive for all of them.

#### Inline servers in `items:`

You can also include `type: server` files directly in the `items` array. Servers start before items in the same stage and stop automatically when the suite completes.

```yaml
type: suite
title: Integration Suite with Inline Mock Server
items:
  - mocks/user-service.mmt    # type: server — starts first
  - mocks/auth-service.mmt    # runs in parallel with above
  - then
  - tests/login.mmt           # tests run after servers are ready
  - tests/profile.mmt
```

This lets you set up complex integration environments declaratively, without manual server management. The suite runner ensures servers are running before dependent tests execute.

## Partial runs

The suite panel supports running a single item (or a subtree) from within the item tree.

- Suite runs are executed via a **suite bundle**.
- Each runnable node in the bundle has an `id`.
- Clicking **Run** on a node sends that node `id` as `target` to the extension host.
- Core executes the subtree rooted at `target` and emits reports tagged with the same `id` so the UI routes output to the correct item.

If you see output appear under the wrong item, it usually means report events are being routed without using `id` (or a per-run `runId`).
