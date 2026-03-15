# SDD: Inline Check/Assert on Call Steps

## Summary

Add optional `check` and `assert` fields to `call` steps in test `.mmt` files. These generate check/assert comparisons that run immediately after the call, referencing the call's output parameters.

## Motivation

Currently, checking a call's output requires separate `check`/`assert` steps that reference the call's `id`. This pattern is verbose for simple validations:

```yaml
# Current (verbose)
- call: login
  id: doLogin
- check: doLogin.status == 200
```

With inline checks, the same thing is:

```yaml
# New (concise)
- call: login
  check: status == 200
```

## Syntax

### String form (single)

```yaml
- call: t1
  inputs:
    username: mehran
  check: result == asds
```

### Array form (multiple)

```yaml
- call: t1
  inputs:
    username: mehran
  check:
    - result == asds
    - status == 200
```

### Assert form

```yaml
- call: t1
  assert: status == 200
```

### Mixed check and assert

```yaml
- call: t1
  check: result == expected_value
  assert: status == 200
```

### With report

```yaml
- call: t1
  check: status == 200
  report: all
```

## Semantics

### Output parameter reference

The left side of each inline comparison is always an **output parameter** of the called API/test. It is internally prefixed with the captured call result variable:

- `status == 200` → generated JS checks `_callResult.status == 200`

Dotted paths are supported: `result.name == John` → `_callResult.result.name == John`.

### Result variable

- If the call has an `id`, use it as the result variable.
- If the call has no `id`, a temporary variable `_<callName>` is generated to capture the output.
- The `id` field remains optional; inline checks do not require it.

### Title

The generated check/assert title is resolved using this priority (first non-empty value wins):

1. **`title`** — explicit `title` field on the call step
2. **Called file title** — the `title` field of the imported `.mmt` file
3. **Import key** — the alias used in the `call` field (e.g. `login`)
4. **Import file name** — the base filename of the imported path (without extension)
5. **`id`** — the `id` field of the call step
6. Fallback: `'call'`

This metadata is threaded from `ImportTracker.getFileTitle()` through a `callMeta` map passed to `callToJSfunc`.

### Details

The generated check/assert details defaults to `${JSON.stringify(<resultVar>)}`, which evaluates to the full call output at runtime.

### Report

- Default report configuration applies (internal: `all`, external: `fails`).
- An optional `report` field on the call step overrides the report level for all generated inline checks/asserts.

### Execution order

1. The call executes and its result is captured.
2. Each inline `check` comparison runs in order (log failure, continue).
3. Each inline `assert` comparison runs in order (throw on failure).

## Changes

### 1. `core/src/TestData.ts`

- Add `check?: Comparison | Comparison[]` to `TestFlowCall`.
- Add `assert?: Comparison | Comparison[]` to `TestFlowCall`.
- Add `report?: ReportLevel | ReportConfig` to `TestFlowCall`.
- Add `title?: string` to `TestFlowCall` for explicit title override.

### 2. `core/src/testParsePack.ts`

- Update `STEP_KEY_ORDER.call` to include `'title'`, `'check'`, `'assert'`, `'report'`.
- `getTestFlowStepType` already checks `'call'` before `'check'`/`'assert'`, so no change needed there.

### 3. `core/src/importTracker.ts`

- Add `setFileTitle` / `getFileTitle` methods to store and retrieve imported file titles.

### 4. `core/src/JSerImports.ts`

- Store file titles in `ImportTracker` during `emitResolved` for test and API files.

### 5. `core/src/JSerTestFlow.ts`

- Add `CallTitleMeta` interface for per-alias import metadata.
- Update `callToJSfunc` signature to accept `callMeta`.
- Title resolution uses priority chain: `step.title || meta.fileTitle || step.call || meta.fileName || step.id || 'call'`.
- Thread `callMeta` through `flowStepsToJsfunc`, `flowStagesToJsfunc`, `flowToJsFunc`, `ifToJSfunc`, `repeatToJSfunc`, `forToJSfunc`.

### 6. `core/src/JSerTest.ts`

- Build `callMeta` from the test's import section and `ImportTracker`, then pass it to `flowToJsFunc`.

### 7. `mmtview/src/text/Schema.tsx`

- Add `check`, `assert`, `title`, and `report` properties to the call step schema.
- `check` / `assert`: `oneOf` string or array of strings.

### 8. `mmtview/src/text/AutoComplete.tsx`

- Add `check`, `assert`, `title`, and `report` to `callSiblings`.
- Update call step documentation to mention inline checks.

### 9. `docs/test-mmt.md`

- Document inline `check`/`assert` on call steps with examples.
- Document the `title` field and title priority chain.

### 10. `core/src/JSer.test.ts`

- Test: call with single string check generates correct JS.
- Test: call with array of checks generates multiple checks.
- Test: call with assert generates assert JS.
- Test: call with both check and assert.
- Test: call with check but no id generates temp variable.
- Test: call with check and id uses id as variable.
- Test: call with report overrides check report level.
