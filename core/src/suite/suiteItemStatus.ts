import {RunResult, SuiteStepStatus} from '../runner/runConfig';

/**
 * Statuses that can be rolled up. Includes UI-only values (`default`,
 * `cancelled`, `debug`) so webview and core share one rule set.
 */
export type AggregatableStepStatus =
  SuiteStepStatus|'default'|'cancelled'|'debug';

/**
 * Map a child run result to a suite-item status:
 * - invalid: unusable file, import/structure problems, or unexpected runtime exception (warning)
 * - failed: checks/asserts failed (fail icon)
 *
 * Structural failures are marked upstream via typed errors
 * (`validationError` / `syntaxError` from ValidationError, ImportCodeError,
 * FileImportError). Assertion aborts and cancellations use AssertionFailedError /
 * TestAbortError, so they arrive here as failed rather than threw+executionError.
 */
export function classifySuiteItemStatus(result?: RunResult|null): SuiteStepStatus {
  if (result?.itemStatus === 'skipped') {
    return 'skipped';
  }
  if (!result || result.success) {
    return 'passed';
  }
  if (result.itemStatus === 'passed' || result.itemStatus === 'failed' ||
      result.itemStatus === 'invalid') {
    return result.itemStatus;
  }
  if (result.syntaxError || result.validationError) {
    return 'invalid';
  }

  // Unexpected runtime exception.
  if (result.threw === true) {
    return 'invalid';
  }

  return 'failed';
}

/**
 * Single "worst wins" rollup for suite/group/tree status icons.
 *
 * Priority (first match wins):
 *   running > cancelled > failed > invalid > pending > default > passed > skipped
 *
 * Rules:
 * - Live states (`running` / `cancelled` / `pending`) stay visible on the parent.
 * - Outcome order matches suite reporting: failed beats invalid; skipped is weakest.
 * - A never-run child (`default`, `debug`, null/undefined) keeps the parent at
 *   `default`, unless a sibling already failed or is invalid (those are decisive).
 * - All skipped (and nothing else) → `skipped`. Empty input → `default`.
 */
export function aggregateStepStatuses(
    statuses: ReadonlyArray<AggregatableStepStatus|null|undefined>,
): AggregatableStepStatus {
  let anyRunning = false;
  let anyCancelled = false;
  let anyFailed = false;
  let anyInvalid = false;
  let anyPending = false;
  let anyUnknown = false;
  let anyPassed = false;
  let anySkipped = false;
  let anySeen = false;

  for (const status of statuses) {
    if (status == null) {
      anyUnknown = true;
      continue;
    }
    anySeen = true;
    if (status === 'running') {
      anyRunning = true;
    } else if (status === 'cancelled') {
      anyCancelled = true;
    } else if (status === 'failed') {
      anyFailed = true;
    } else if (status === 'invalid') {
      anyInvalid = true;
    } else if (status === 'pending') {
      anyPending = true;
    } else if (status === 'passed') {
      anyPassed = true;
    } else if (status === 'skipped') {
      anySkipped = true;
    } else {
      // default, debug, or anything else → treat as never-run / unknown
      anyUnknown = true;
    }
  }

  if (!anySeen && !anyUnknown) {
    return 'default';
  }
  if (anyRunning) {
    return 'running';
  }
  if (anyCancelled) {
    return 'cancelled';
  }
  if (anyFailed) {
    return 'failed';
  }
  if (anyInvalid) {
    return 'invalid';
  }
  if (anyPending) {
    return 'pending';
  }
  if (anyUnknown) {
    return 'default';
  }
  if (anyPassed) {
    return 'passed';
  }
  if (anySkipped) {
    return 'skipped';
  }
  return 'default';
}

/**
 * Core suite-item aggregator. Same rules as {@link aggregateStepStatuses}, with
 * UI-only results mapped into {@link SuiteStepStatus}:
 * - `default` → `passed` (empty / never-run should not surface as a suite item)
 * - `cancelled` → `failed` (suite items have no cancelled status)
 * - `debug` → `passed`
 */
export function worstSuiteItemStatus(statuses: SuiteStepStatus[]): SuiteStepStatus {
  const rolled = aggregateStepStatuses(statuses);
  if (rolled === 'default' || rolled === 'debug') {
    return 'passed';
  }
  if (rolled === 'cancelled') {
    return 'failed';
  }
  return rolled;
}
