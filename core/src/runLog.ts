import {LogLevel} from './CommonData';

export type RunKind = 'Test'|'API'|'Suite'|'Load Test';

export type RunFinishStatus = 'passed'|'failed'|'error';

/** Shared finished/failed/error log format used by JS runs and suite runs. */
export function logRunFinished(
    logger: (level: LogLevel, message: string) => void,
    runKind: RunKind|string,
    title: string|undefined,
    success: boolean,
    durationMs?: number,
    options?: {hasError?: boolean}): void {
  const kind = runKind || 'Test';
  const name = typeof title === 'string' ? title.trim() : '';
  const label = name ? `${kind} "${name}"` : kind;
  if (success) {
    const elapsed = typeof durationMs === 'number' ? durationMs : 0;
    logger('info', `${label} finished in ${elapsed} ms successfully`);
    return;
  }
  // Runtime/exception path vs assertion/check failure path.
  if (options?.hasError) {
    logger('error', `${label} has error`);
    return;
  }
  logger('error', `${label} failed`);
}
