import {RunResult, SuiteStepStatus} from '../runner/runConfig';

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

/** Prefer failed (assertions/checks) over invalid (structure/runtime issues). Skipped is weakest. */
export function worstSuiteItemStatus(statuses: SuiteStepStatus[]): SuiteStepStatus {
  let anyFailed = false;
  let anyInvalid = false;
  let anyPassed = false;
  let anySkipped = false;
  for (const s of statuses) {
    if (s === 'failed') {
      anyFailed = true;
    } else if (s === 'invalid') {
      anyInvalid = true;
    } else if (s === 'passed' || s === 'running' || s === 'pending') {
      anyPassed = true;
    } else if (s === 'skipped') {
      anySkipped = true;
    }
  }
  if (anyFailed) {
    return 'failed';
  }
  if (anyInvalid) {
    return 'invalid';
  }
  if (anyPassed) {
    return 'passed';
  }
  if (anySkipped) {
    return 'skipped';
  }
  return 'passed';
}
