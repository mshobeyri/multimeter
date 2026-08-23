export interface CallStepBlock {
  alias: string;
  field: string;
}

const CALL_LINE = /^-\s*call:\s*(.+)$/;

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

/**
 * Walk up from a 1-based cursor line to a `field:` key, then its parent `- call:`.
 * `lineNumber` matches Monaco (the current line is not searched).
 */
export function findCallStepBlock(
  lines: string[],
  lineNumber: number,
  currentIndent: number,
  fieldKeys: string[],
): CallStepBlock | null {
  const fieldSet = new Set(fieldKeys);
  let foundField: string | null = null;
  let fieldIndent = -1;

  for (let i = lineNumber - 2; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();

    if (!foundField) {
      const keyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
      if (indent < currentIndent && keyMatch && fieldSet.has(keyMatch[1])) {
        foundField = keyMatch[1];
        fieldIndent = indent;
        continue;
      }
      if (indent < currentIndent) {
        return null;
      }
      continue;
    }

    if (indent < fieldIndent) {
      const callMatch = trimmed.match(CALL_LINE);
      if (callMatch) {
        return {alias: unquote(callMatch[1]), field: foundField};
      }
      return null;
    }
  }
  return null;
}
