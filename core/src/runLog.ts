import {LogLevel} from './CommonData';

export type RunKind = 'Test'|'API'|'Suite'|'Load Test';

/** Shared finished/failed log format used by JS runs and suite runs. */
export function logRunFinished(
    logger: (level: LogLevel, message: string) => void,
    runKind: RunKind|string,
    title: string|undefined,
    success: boolean,
    durationMs?: number): void {
  const kind = runKind || 'Test';
  const name = typeof title === 'string' ? title.trim() : '';
  const label = name ? `${kind} "${name}"` : kind;
  if (success) {
    const elapsed = typeof durationMs === 'number' ? durationMs : 0;
    logger('info', `${label} finished in ${elapsed} ms successfully`);
  } else {
    logger('error', `${label} failed`);
  }
}
