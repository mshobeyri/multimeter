# SDD: Codebase Refactoring — February 2026

## Overview
This document tracks 20 refactoring tasks identified through a comprehensive codebase audit. Each item addresses code duplication, type safety issues, dead code, or structural improvements. Items are ordered by impact (high → low).

---

## Status Key
- [ ] Not started
- [x] Completed

---

## 1. Deduplicate `findProjectRoot` (3 copies) — HIGH
**Files:** `src/mmtAPI/run.ts`, `src/mmtAPI/file.ts`, `mmtcli/src/runArgs.ts`
**Problem:** Three nearly-identical implementations of "walk up directory tree looking for `multimeter.mmt`".
**Fix:** Extract a single `findProjectRoot(startPath, existsSync)` into `core/src/fileHelper.ts`; extension and CLI call it with their FS adapter.
- [x] Done

## 2. Deduplicate env-storage extraction — HIGH
**Files:** `src/mmtAPI/run.ts`
**Problem:** Identical ~12-line blocks extract `envVars` from workspace state in `handleRunCurrentDocument` and `handleRunSuite`.
**Fix:** Extract `extractEnvVarsFromWorkspaceState(mmtProvider)` helper function.
- [x] Done

## 3. Deduplicate certificate-matching expression — HIGH
**File:** `core/src/networkCore.ts`
**Problem:** `cert.host === hostname || hostname.includes(cert.host) || cert.host === '*'` appears 3 times.
**Fix:** Extract `findMatchingClientCert(hostname, clients)` helper.
- [x] Done

## 4. Consolidate certificate type definitions — HIGH
**Files:** `core/src/NetworkData.ts`, `core/src/network.ts`, `src/mmtAPI/network.ts`, `src/workspaceEnvLoader.ts`, `mmtview/src/environment/EnvironmentData.tsx`
**Problem:** Certificate types defined in 5 places with slight variations.
**Fix:** Single source of truth in `core/src/NetworkData.ts`; other modules import from there.
- [x] Done

## 5. Eliminate excessive `as any` casts in runner pipeline — HIGH
**Files:** `core/src/runner.ts`, `core/src/suiteBundleRunner.ts`, `src/mmtAPI/run.ts`
**Problem:** 15+ `as any` casts for suite-related properties not formally in `RunFileOptions`.
**Fix:** Extend `RunFileOptions` in `core/src/runConfig.ts` with proper optional properties.
- [x] Done

## 6. Deduplicate `checkToJSfunc` / `assertToJSfunc` — HIGH
**File:** `core/src/JSerTestFlow.ts`
**Problem:** ~70 lines of pure duplication between these two functions.
**Fix:** Extract `comparisonToJSfunc(type: 'check'|'assert', ...)`.
- [x] Done

## 7. Deduplicate `runSuiteTest` / `runSuiteSuite` — HIGH
**File:** `core/src/suiteBundleRunner.ts`
**Problem:** Both follow identical resolve → emit → run → emit pattern (~160 lines).
**Fix:** Extract shared `runSuiteBundleNode` parameterized by node kind.
- [x] Done

## 8. Deduplicate `buildNetworkConfig` between extension and CLI — HIGH
**Files:** `src/mmtAPI/network.ts`, `mmtcli/src/runArgs.ts`
**Problem:** Both assemble `NetworkConfig` from cert settings with structurally identical logic.
**Fix:** Extract pure function in `core` with a `readFile` adapter parameter.
- [x] Done

## 9. Split `handleRunSuite` (~130 lines) — HIGH
**File:** `src/mmtAPI/run.ts`
**Problem:** One massive function handles env, network, hierarchy, bundle, running, events, and cancel.
**Fix:** Break into `prepareRunEnvironment()`, `buildSuiteBundleForRun()`, and the run call.
- [x] Done

## 10. Merge `report_` / `reportWithContext_` — MEDIUM
**File:** `core/src/testHelper.ts`
**Problem:** Near-identical payload construction (~20 lines each).
**Fix:** Single function with optional context parameters, global fallback.
- [x] Done

## 11. Merge `setenv_` / `setenvWithContext_` — MEDIUM
**File:** `core/src/testHelper.ts`
**Problem:** Same duplication pattern as #10.
**Fix:** Create generic `emitEvent(scope, payload, reporterCtx?)`.
- [x] Done

## 12. Deduplicate `normalizeTokenName` — MEDIUM
**Files:** `core/src/jsRunner.ts`, `core/src/variableReplacer.ts`
**Problem:** Identical 4-line function in two modules.
**Fix:** Move to shared utility, import in both.
- [x] Done

## 13. Deduplicate time-unit parsing — MEDIUM
**File:** `core/src/JSerTestFlow.ts`
**Problem:** `repeatToJSfunc` and `delayToJSfunc` parse `ns|ms|s|m|h` identically.
**Fix:** Extract `parseTimeToMs(value)` helper.
- [x] Done

## 14. Deduplicate `resolveCertPath` — MEDIUM
**Files:** `src/mmtAPI/network.ts`, `mmtcli/src/runArgs.ts`
**Problem:** Same path-resolution logic duplicated.
**Fix:** Centralize in `core`.
- [x] Done

## 15. Export `DEFAULT_NETWORK_CONFIG` — MEDIUM
**Files:** `core/src/networkCore.ts`, `mmtcli/src/runArgs.ts`
**Problem:** Identical default `NetworkConfig` object defined in two places.
**Fix:** Export canonical default from `core/src/NetworkData.ts`.
- [x] Done

## 16. Remove dead duplicate `case 'info'` — MEDIUM
**File:** `src/mmtAPI/run.ts`
**Problem:** `case 'info'` appears twice in logger switch; second is unreachable.
**Fix:** Delete the dead case.
- [x] Done

## 17. Reduce CLI module-resolution boilerplate — MEDIUM
**File:** `mmtcli/src/cli.ts`
**Problem:** ~80 lines of try/catch for resolving two core exports.
**Fix:** Generic `resolveCoreExport<T>(name, fallback)` helper.
- [x] Done

## 18. Refactor `extension.ts` `activate()` — MEDIUM
**File:** `src/extension.ts`
**Problem:** 140-line flat function with 15+ registrations.
**Fix:** Group into `registerCommands()`, `registerPanels()`, `registerEditorProvider()`.
- [x] Done

## 19. Clean up `flowStepsToJsfunc` dead code — MEDIUM
**File:** `core/src/JSerTestFlow.ts`
**Problem:** Dead `'data'` case, unused variable, redundant `set`/`var`/`const`/`let` cases.
**Fix:** Remove dead code, merge similar cases.
- [x] Done

## 20. Fix `messageRecieved` typo — LOW
**Files:** `src/mmtAPI/mmtAPI.ts`, `src/mmtEditorProvider.ts`
**Problem:** Exported function misspelled (`Recieved` → `Received`).
**Fix:** Rename across both files.
- [x] Done
