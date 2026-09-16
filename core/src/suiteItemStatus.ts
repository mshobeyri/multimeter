import {RunResult, SuiteStepStatus} from './runConfig';

/** Patterns that indicate a validation/structural error rather than a test-case failure. */
const INVALID_ERROR_PATTERNS = [
  'Invalid test file',
  'Invalid API file',
  'Invalid suite',
  'Not a suite document',
  'Import error',
  'unknown key(s)',
  'is not imported',
  'undefined input(s)',
  'YAML',
  'File not found',
  'Circular suite reference',
];

export function isValidationErrorMessage(message: string): boolean {
  return INVALID_ERROR_PATTERNS.some(p => message.includes(p));
}

/**
 * Map a child run result to a suite-item status:
 * - invalid: unusable file, import/structure problems, or unexpected runtime exception (warning)
 * - failed: checks/asserts failed (fail icon)
 *
 * Assertion aborts and cancellations are classified upstream via typed errors
 * (AssertionFailedError / TestAbortError), so they arrive here as failed /
 * cancelled rather than threw+executionError.
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
  if (result.syntaxError) {
    return 'invalid';
  }

  const messages = [
    result.executionError,
    ...(Array.isArray(result.errors) ? result.errors : []),
  ].filter((m): m is string => typeof m === 'string' && m.length > 0);

  if (messages.some(m => isValidationErrorMessage(m))) {
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
