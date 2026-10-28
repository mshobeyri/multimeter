import {
  ACCESSOR_PATH_RE,
  TOKEN_NAME_RE,
} from 'mmt-core/tokens/variableReplacer';

export type EnvTokenTarget = {
  /** Environment variable name (no accessor). */
  name: string;
  range: any;
};

const ENV_TOKEN_GLOBAL_RE = new RegExp(
    `(?:<<\\s*|\\{\\{\\s*)?e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*(?:>>|\\}\\})?`,
    'gi');

function positionToOffset(
    content: string, lineNumber: number, column: number): number {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return offset + Math.max(0, column - 1);
}

function offsetToPosition(
    content: string, offset: number): {line: number; column: number} {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let remaining = Math.max(0, offset);
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length;
    if (remaining <= lineLen) {
      return {line: i + 1, column: remaining + 1};
    }
    remaining -= lineLen + 1;
  }
  const last = lines.length;
  return {line: last, column: (lines[last - 1]?.length || 0) + 1};
}

/**
 * Ctrl/Cmd+hover/click target for an `e:name` / `<<e:name>>` / `{{e:name}}`
 * token (optional accessor). Returns the base env variable name.
 */
export function getEnvTokenTargetAtPosition(
    monaco: any,
    model: any,
    content: string,
    pos: {lineNumber: number; column: number}|null|undefined,
    ): EnvTokenTarget|null {
  if (!monaco || !model || !pos || !content) {
    return null;
  }
  const lineNumber = pos.lineNumber;
  const lineContent: string = model.getLineContent(lineNumber);
  if (!lineContent) {
    return null;
  }

  const lineStart = positionToOffset(content, lineNumber, 1);
  const cursorInLine = Math.max(0, pos.column - 1);

  ENV_TOKEN_GLOBAL_RE.lastIndex = 0;
  let match: RegExpExecArray|null;
  while ((match = ENV_TOKEN_GLOBAL_RE.exec(lineContent)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursorInLine < start || cursorInLine >= end) {
      continue;
    }
    const name = match[1];
    if (!name) {
      continue;
    }
    // Skip quoted bare tokens meant as literal text only when the whole match
    // is `"e:name"` — those keep the quotes outside this regex. Fine as-is.
    const absStart = lineStart + start;
    const absEnd = lineStart + end;
    const startPos = offsetToPosition(content, absStart);
    const endPos = offsetToPosition(content, absEnd);
    return {
      name,
      range: new monaco.Range(
          startPos.line, startPos.column, endPos.line, endPos.column),
    };
  }
  return null;
}
