/** Default in-memory report budget before spilling to internal browser storage. */
export const DEFAULT_REPORT_SPILL_BYTES = 2 * 1024 * 1024;

const CACHE_KEY = '__mmtReportSpillBytes';

function webviewWindow(): Window | undefined {
  return typeof globalThis === 'undefined' ? undefined : (globalThis as typeof globalThis & { window?: Window }).window;
}

export function cacheReportSpillBytes(value: number): void {
  const win = webviewWindow() as (Window & Record<string, unknown>) | undefined;
  if (!win) {
    return;
  }
  win[CACHE_KEY] = value;
}

export function readReportSpillBytes(): number {
  const win = webviewWindow() as (Window & Record<string, unknown>) | undefined;
  const cached = win?.[CACHE_KEY];
  if (typeof cached === 'number' && Number.isFinite(cached) && cached >= 0) {
    return cached;
  }
  return DEFAULT_REPORT_SPILL_BYTES;
}
