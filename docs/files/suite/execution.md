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

See [Mock servers in suites](../server/in-suites.md) for a quick overview. Details below.

A suite or test run keeps one **public running-server list**. Starting a mock that is already on that list is a no-op — whether the start came from suite `servers:`, an item server, or a test `run:` step. Nested suites and later items share the list. Servers stay up until the **outermost** run finishes.

#### Suite-level servers (`servers:` field)

Use the top-level `servers:` field to start mock servers at the **beginning of that suite**, before any `items`. Nested suites do the same when that nested suite starts. `environment:` and `export:` stay root-only.

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

This is the recommended way to keep mocks alive for every item in the suite. The same server listed again in a nested suite is skipped, not restarted.

#### Inline servers in `items:`

Include `type: server` files in `items` when the mock should start **at that position** (after earlier `then` stages). Within a stage, item servers start before tests and nested suites in that stage.

```yaml
type: suite
title: Integration Suite with Inline Mock Server
items:
  - tests/setup.mmt
  - then
  - mocks/user-service.mmt    # starts here, after setup
  - then
  - tests/login.mmt
  - tests/profile.mmt
```

Do not list the same file in both `servers:` and `items:` of one suite file — the editor underlines that as an error. The same server in a nested import is allowed.

## Partial runs

The suite panel supports running a single item (or a subtree) from within the item tree.

- Suite runs are executed via a **suite bundle**.
- Each runnable node in the bundle has an `id`.
- Clicking **Run** on a node sends that node `id` as `target` to the extension host.
- Core executes the subtree rooted at `target` and emits reports tagged with the same `id` so the UI routes output to the correct item.

If you see output appear under the wrong item, it usually means report events are being routed without using `id` (or a per-run `runId`).

## Tag filter

Use `filter:` on a suite to restrict which tests (and nested suites) run. Tags live on `type: test` and `type: suite` files (`tags:`).

```yaml
type: suite
title: CI
filter:
  only:
    - smoke
    - api
  skip:
    - flaky
items:
  - ./tests/login.mmt
  - ./tests/slow.mmt
```

- `only:` — if non-empty, a node runs only when it has at least one of those tags (OR). Empty `only` means all.
- `skip:` — if non-empty, a node is skipped when it has any of those tags (OR). Empty `skip` means none.
- Order is **only, then skip**: `run iff matchesOnly && !matchesSkip`.
- Nested **running** suites merge: `only` lists AND (each list is still OR), `skip` lists OR.
- `filter:` on a nested suite is ignored while walking into it to find matching children; it applies when that suite itself is selected to run.
- CLI: `testlight run suite.mmt --tag smoke --skip-tag flaky` (repeatable; comma-separated is OK). CLI tags replace the `filter:` of the file you run.
- In VS Code, edit `filter:` in the {{btn:filter:Filter}} tab of [Edit Suite](./edit.md#filter). The suite panel lists the active filter **below the Items tree** when `filter:` is configured.
- Put `filter:` before `items:` in YAML (canonical order). Out-of-order keys show **YAML ERROR** in the run bar; use **Format Document** (Shift+Alt+F) to fix.

Skipped items are reported as skipped (not failed). A group that only contains skipped items is skipped; mixed passed + skipped still counts as passed.

Runnable walkthrough: [Suite tag filter example](../../../examples/intermediate/29_suite_tag_filter/README.md).
