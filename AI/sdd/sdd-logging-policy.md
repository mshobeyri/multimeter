# SDD: Logging Policy

This document defines the logging-level policy for all `.mmt` run types (API, Test, Suite) across every entry point (webview glyph button, CLI, AI assistant).

## Log levels

The runner uses the standard `LogLevel` type defined in `core/src/CommonData.ts`:

| Level   | Severity | Typical use |
|---------|----------|-------------|
| `trace` | lowest   | Network request/response details during test runs |
| `debug` | low      | Network request/response for API runs; environment vars; imported print statements |
| `info`  | normal   | Inputs, outputs, check passes, direct print statements, run lifecycle |
| `warn`  | elevated | Non-fatal issues (e.g. example not found) |
| `error` | highest  | Check/assert failures, runtime exceptions |

A run's `success` flag is determined by whether any `error`-level messages were logged (`RunResult.success = errors.length === 0`).

## Console mapping

Generated JS uses `console.*` calls which the custom console in `core/src/jsRunner.ts` maps to `LogLevel`:

| `console.*` call | `LogLevel` |
|------------------|------------|
| `console.trace`  | `trace`    |
| `console.debug`  | `debug`    |
| `console.log`    | `info`     |
| `console.warn`   | `warn`     |
| `console.error`  | `error`    |

## Test runs (`type: test`)

| What | Direct run level | Imported/suite child level | Implementation |
|------|-----------------|---------------------------|----------------|
| **Check/assert** | follows report config (see below) | follows report config (see below) | `JSerTestFlow.ts` |
| **Print step** | `info` | `debug` | `console.log` (root) / `console.debug` (!root) in `JSerTestFlow.ts` |
| **Request/response** | `trace` | `trace` | `traceSend` wrapper in `jsRunner.ts` |
| **Run start** | `info` | `info` | `jsRunner.ts` |
| **Run finish** | `info` | `info` | `jsRunner.ts` |
| **Run error (exception)** | `error` | `error` | `jsRunner.ts` |

### Check/assert log levels

Log levels for check and assert steps follow the **report config**. The report config determines whether a result is reported to the UI; the log level mirrors that intent:

| Report level | Fail log level | Success log level |
|-------------|----------------|-------------------|
| `none`      | `debug`        | `trace`           |
| `fails`     | `error`        | `debug`           |
| `all`       | `error`        | `info`            |

Default report config:
- **Internal** (direct run): `'all'` → fail=`error`, success=`info`
- **External** (imported/suite): `'fails'` → fail=`error`, success=`debug`

This means by default:
- A direct-run check **pass** logs at `info`; a **fail** logs at `error`
- An imported/suite check **pass** logs at `debug`; a **fail** logs at `error`
- When `report: none`, results still appear in logs but at lower severity

### Report config

The report config controls **which** check results are emitted via the `reporter` (structured events to UI), not which are logged:

| Report mode | Internal (direct run) default | External (imported) default |
|-------------|------------------------------|-----------------------------|
| `internal`  | `'all'` (pass + fail)        | —                           |
| `external`  | —                            | `'fails'` (fail only)       |

Override these per-check via the `report` property in check/assert steps.

## API runs (`type: api`)

| What | Level | Implementation |
|------|-------|----------------|
| **Request** (url, method, headers, query, body) | `debug` | `console.debug` in `runApi.ts` |
| **Response** (status, headers, body, duration) | `debug` | `console.debug` in `runApi.ts` |
| **Environment** vars | `debug` | `console.debug` in `runApi.ts` |
| **Inputs** | `info` | `console.log` in `runApi.ts` |
| **Outputs** | `info` | `console.log` in `runApi.ts` |
| **Example label** | `info` | `console.log` in `runApi.ts` |
| **Example not found** | `warn` | direct `logger` call in `runApi.ts` |

## Suite runs (`type: suite`)

Suite runs delegate to child test/API runs. The same policies above apply to each child, with these additions:

| What | Level | Implementation |
|------|-------|----------------|
| **Suite item start** | `info` | `suiteBundleRunner.ts` / `runSuite.ts` |
| **Suite item failure** | `error` | `suiteBundleRunner.ts` / `runSuite.ts` |
| **Suite cancelled** | `warn` | `suiteBundleRunner.ts` / `runSuite.ts` |

Child test runs execute with `isExternal: true`, which means:
- Print steps log at `debug` (not `info`)
- Report config defaults to `external: 'fails'`

All other levels (checks, request/response) remain the same.

## Entry points

All three entry points use `core/src/runner.ts` → `runFile()` with injected `logger` and `reporter`:

| Entry point | Logger target | Reporter behavior |
|-------------|--------------|-------------------|
| **Webview glyph button** | VS Code Output Channel (`"Multimeter"`) | Forwards to webview via `postMessage` |
| **CLI** (`testlight`) | stdout (`console.log`) | No-op |
| **AI assistant** | VS Code Output Channel (same as glyph) | No-op |

The logger's effective filter level:
- **VS Code** — controlled by the Output Channel log level setting
- **CLI** — no filtering (all levels printed)

### Output destinations

| Destination | What goes there |
|-------------|----------------|
| VS Code Output Channel | All `logger` calls (webview + AI) |
| Webview (via `postMessage`) | All `reporter` events (test steps, suite items, lifecycle) |
| stdout | All `logger` calls (CLI only) |
| `RunResult.logs` | All messages regardless of level |
| `RunResult.errors` | Only `error`-level messages |

## Implementation files

| File | Role |
|------|------|
| [`core/src/jsRunner.ts`](../core/src/jsRunner.ts) | Custom console mapping, `traceSend` wrapper, run lifecycle logging |
| [`core/src/runApi.ts`](../core/src/runApi.ts) | API request/response/inputs/outputs logging |
| [`core/src/runTest.ts`](../core/src/runTest.ts) | Test execution, enables `traceSend` |
| [`core/src/JSerTestFlow.ts`](../core/src/JSerTestFlow.ts) | Check/assert/print code generation with log levels |
| [`core/src/runCommon.ts`](../core/src/runCommon.ts) | `runGeneratedJs` — log accumulation and error tracking |
| [`core/src/suiteBundleRunner.ts`](../core/src/suiteBundleRunner.ts) | Suite bundle execution and lifecycle logging |
| [`core/src/runSuite.ts`](../core/src/runSuite.ts) | Legacy suite execution |
| [`core/src/testHelper.ts`](../core/src/testHelper.ts) | Reporter event emission (structured, not logged) |

## Related docs

- [API `.mmt` reference](../docs/api-mmt.md) — API file format and examples
- [Test `.mmt` reference](../docs/test-mmt.md) — Test file format, check/assert/print steps
- [Suite `.mmt` reference](../docs/suite-mmt.md) — Suite file format
- [Environment reference](../docs/environment-mmt.md) — Environment variables
- [CLI (`testlight`) reference](../docs/testlight.md) — CLI usage and flags
