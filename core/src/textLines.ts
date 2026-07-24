/**
 * Split text into lines after normalizing Windows/legacy newlines.
 * Required before `$`-anchored or `.+` regexes: in JS, `.` does not match `\r`,
 * so `split('\n')` alone leaves trailing CRs that break those patterns.
 */
export function splitNormalizedLines(text: string): string[] {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/** Normalize CRLF/CR to LF without splitting. */
export function normalizeNewlines(text: string): string {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
