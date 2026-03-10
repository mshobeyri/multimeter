# SDD: Suite Environment and Export Configuration

**Date:** 2026-03-10
**Status:** Implemented

---

## Summary

Add two new top-level fields to `type: suite` files:
- **`environment`**: Configure environment variables for suite runs (preset selection, file reference, inline variables)
- **`export`**: Generate report files after suite completion (JUnit XML, HTML, Markdown, MMT)

Both fields are **root-only** — they take effect only when the suite is executed directly, not when imported by another suite.

---

## Motivation

### Environment

Currently, environment variables for suite runs must be specified externally:
- CLI: `--env-file`, `--preset`, `-e` flags
- VS Code: Local storage variables or env panel

This creates friction:
- Suites aren't self-documenting about their expected environment
- CI pipelines need separate configuration for each suite
- No way to bundle a suite with its preferred preset

By adding `environment` to suites:
- Suites can declare their default environment configuration
- CI runs become simpler (fewer flags)
- Developers can see at a glance what environment a suite expects

### Export

Currently, generating reports requires:
- CLI: `--report` and `--report-file` flags
- VS Code: Manual export after run

By adding `export` to suites:
- Suites can declare their output artifacts
- CI pipelines get consistent reports without flag configuration
- Multiple report formats can be generated in a single run

---

## Design

### 1. `environment` Field

The `environment` field configures environment variables for the suite run.

```yaml
type: suite
title: Smoke Tests
environment:
  preset: dev                           # select preset from project multimeter.mmt
  file: ./envs/staging.mmt              # optional: load from another env file
  variables:                            # inline variables
    API_URL: http://localhost:8080
    TIMEOUT: 30000
    DEBUG: true
tests:
  - test/login.mmt
  - test/profile.mmt
```

#### Sub-fields

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name from `multimeter.mmt` (or `file` if specified) |
| `file` | `string` | Path to an env file to load (relative to suite or `+/` project root) |
| `variables` | `Record<string, any>` | Inline key-value environment variables |

#### Priority Order

Environment variables are resolved with the following priority (highest wins):

**CLI (testlight):**
1. CLI `-e` flags (highest)
2. Suite `environment.variables`
3. Suite `environment.preset` (from `multimeter.mmt` or `environment.file`)
4. CLI `--env-file` + `--preset`
5. Project `multimeter.mmt` defaults (lowest)

**VS Code UI:**
1. Suite `environment.variables` (highest)
2. Suite `environment.preset`
3. VS Code local storage variables
4. CLI `--env-file` + `--preset` (via env panel)
5. Project `multimeter.mmt` defaults (lowest)

> **Note:** CLI `-e` takes highest priority in testlight because it's an explicit override at invocation time. In VS Code, the suite's embedded configuration takes precedence since there's no equivalent runtime override.

#### Data Model

Add to `SuiteData.ts`:

```typescript
export interface SuiteEnvironment {
  preset?: string;
  file?: string;
  variables?: Record<string, unknown>;
}

export interface SuiteData {
  // existing fields
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  tests: string[];
  servers?: string[];
  
  // new field
  environment?: SuiteEnvironment;
}
```

### 2. `export` Field

The `export` field specifies files to generate after the suite completes.

```yaml
type: suite
title: CI Suite
tests:
  - test/login.mmt
  - test/profile.mmt
export:
  - ./reports/results.xml     # JUnit XML
  - ./reports/results.html    # HTML report
  - ./reports/results.md      # Markdown report
  - ./reports/results.mmt     # MMT format
```

#### Export Type by Extension

| Extension | Format | Description |
|-----------|--------|-------------|
| `.xml` | JUnit XML | Standard CI format (Jenkins, GitLab, etc.) |
| `.html` | HTML | Human-readable report with styling |
| `.md` | Markdown | Plain text report for docs/PRs |
| `.mmt` | MMT | Structured result data in YAML |

#### Behavior

- Exports are generated **after the entire suite finishes** (regardless of pass/fail)
- Paths are relative to the suite file (or `+/` for project root)
- Parent directories are created if they don't exist
- Errors during export are logged but don't fail the suite

#### Data Model

```typescript
export interface SuiteData {
  // existing fields
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  tests: string[];
  servers?: string[];
  environment?: SuiteEnvironment;
  
  // new field
  export?: string[];
}
```

### 3. Root-Only Behavior

Both `environment` and `export` are **root-only** fields — they only take effect when the suite is the entry point.

When Suite A imports Suite B:
- Suite A's `environment` and `export` apply
- Suite B's `environment` and `export` are **ignored**

This matches the existing behavior of `servers`:

| Field | Root Suite | Imported Suite |
|-------|------------|----------------|
| `servers` | ✅ Starts servers | ❌ Ignored |
| `environment` | ✅ Configures env | ❌ Ignored |
| `export` | ✅ Generates reports | ❌ Ignored |

#### Rationale

- **Environment**: The root suite controls the execution context. Allowing imported suites to override environment would create unpredictable behavior.
- **Export**: Only the root suite knows where to write outputs. Imported suites generating their own reports would create conflicting files.
- **Servers**: Servers must be managed at a single level to avoid port conflicts and lifecycle issues.

---

## Implementation Plan

### Phase 1: Data Model & Parsing

1. **SuiteData.ts**: Add `SuiteEnvironment` interface and update `SuiteData`
2. **suiteParsePack.ts**: Parse `environment` and `export` fields
3. **suiteBundle.ts**: Pass root-level environment config to execution

### Phase 2: Environment Integration

1. **runner.ts**: Accept suite environment config in `runFile` options
2. **cli.ts**: Merge suite environment with CLI flags (respecting priority)
3. **mmtEditorProvider.ts**: Merge suite environment with VS Code context

### Phase 3: Export Integration

1. **reportGenerator.ts**: Add function to generate reports from suite results
2. **executeSuiteBundle**: Call export after suite completion
3. **cli.ts**: Support export paths from suite definition

### Phase 4: Documentation

1. Update `docs/suite-mmt.md` with `environment` and `export` sections
2. Update `docs/testlight.md` with priority documentation
3. Add root-only note to `servers` documentation

---

## Example: Full Suite with Environment and Export

```yaml
type: suite
title: E2E Integration Tests
description: Full integration test suite with mock servers and staging environment
tags:
  - e2e
  - integration

environment:
  preset: staging
  variables:
    PARALLEL_WORKERS: 4
    RETRY_COUNT: 2

servers:
  - mocks/user-service.mmt
  - mocks/payment-service.mmt

tests:
  - tests/auth/login.mmt
  - tests/auth/register.mmt
  - then
  - tests/orders/create.mmt
  - tests/orders/payment.mmt
  - then
  - tests/cleanup.mmt

export:
  - +/reports/e2e-results.xml
  - +/reports/e2e-results.html
```

---

## CLI Examples

```sh
# Suite environment applies by default
testlight run suites/e2e.mmt

# CLI -e overrides suite environment.variables
testlight run suites/e2e.mmt -e PARALLEL_WORKERS=1

# CLI --preset overrides suite environment.preset
testlight run suites/e2e.mmt --preset production

# Exports are generated automatically after suite completes
# (./reports/e2e-results.xml, ./reports/e2e-results.html)
```

---

## Open Questions

1. **Should `export` support custom format specifiers?**  
   e.g., `{ file: ./report.xml, format: junit }` for cases where extension doesn't match format.  
   *Recommendation: Start with extension-based detection, add explicit format later if needed.*

2. **Should exports be conditional on suite status?**  
   e.g., only export JUnit on failure for faster CI.  
   *Recommendation: Always export; CI tools can filter results themselves.*

3. **Should `environment.file` support its own `preset` sub-field?**  
   e.g., `file: ./staging.mmt` with `preset: fast`
   *Current design: `preset` applies to `file` if specified, otherwise to `multimeter.mmt`.*

---

## Related Documents

- [Suite](../docs/suite-mmt.md) — Suite file reference
- [Environment](../docs/environment-mmt.md) — Environment files and presets
- [Reports](../docs/reports.md) — Report formats
- [SDD: Mock Server Integration](./sdd-mock-server-integration.md) — `servers` field behavior
