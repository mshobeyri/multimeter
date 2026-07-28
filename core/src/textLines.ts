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

/** Detect dominant newline style (CRLF wins when present). */
export function detectNewline(text: string): '\r\n' | '\n' | '\r' {
  const s = String(text ?? '');
  if (s.includes('\r\n')) {
    return '\r\n';
  }
  if (s.includes('\r')) {
    return '\r';
  }
  return '\n';
}

/** Re-join lines using the given newline style. */
export function joinLines(lines: string[], eol: '\r\n' | '\n' | '\r' = '\n'): string {
  return lines.join(eol);
}

/** Rewrite text to use the given newline style (content otherwise unchanged). */
export function withNewline(text: string, eol: '\r\n' | '\n' | '\r'): string {
  return joinLines(splitNormalizedLines(text), eol);
}
