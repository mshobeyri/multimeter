import {currentValueForToken} from 'mmt-core/tokens/Current';
import {randomValueForToken} from 'mmt-core/tokens/Random';
import {applyValueAccessor, ACCESSOR_PATH_RE, TOKEN_NAME_RE} from
    'mmt-core/tokens/variableReplacer';
import {resolveWorkspaceEnvMap} from 'mmt-core/env/workspaceEnvVars';

export type DynamicTokenTarget = {
  /** Full plain token, e.g. `e:host` or `c:day` or `r:uuid`. */
  plain: string;
  /** Prefix letter. */
  prefix: 'e'|'r'|'c';
  range: any;
};

/** Loose r:/c: name + optional `(…)` args (same idea as token highlights). */
const RUNTIME_SPEC_RE = `${TOKEN_NAME_RE}(?:\\([^)]*\\))?`;

const DYNAMIC_TOKEN_GLOBAL_RE = new RegExp(
    `(?:<<\\s*|\\{\\{\\s*)?([erc]):((?:${RUNTIME_SPEC_RE})|(?:${TOKEN_NAME_RE}))(${ACCESSOR_PATH_RE})\\s*(?:>>|\\}\\})?`,
    'gi');

let hoverEnvMap: Record<string, unknown> = {};

/** Update the env map used by YAML token hover (workspace storage). */
export function setTokenHoverEnvVariables(
    variables: Array<{name?: unknown; value?: unknown; source?: unknown}>|
    null|undefined): void {
  hoverEnvMap = resolveWorkspaceEnvMap(variables || []);
}

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
 * Hover/Ctrl target for `e:` / `r:` / `c:` (bare, `<< >>`, or `{{ }}`).
 */
export function getDynamicTokenTargetAtPosition(
    monaco: any,
    model: any,
    content: string,
    pos: {lineNumber: number; column: number}|null|undefined,
    ): DynamicTokenTarget|null {
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

  DYNAMIC_TOKEN_GLOBAL_RE.lastIndex = 0;
  let match: RegExpExecArray|null;
  while ((match = DYNAMIC_TOKEN_GLOBAL_RE.exec(lineContent)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursorInLine < start || cursorInLine >= end) {
      continue;
    }
    const prefix = (match[1] || '').toLowerCase() as 'e'|'r'|'c';
    const spec = match[2];
    const accessor = match[3] || '';
    if (!prefix || !spec || !'erc'.includes(prefix)) {
      continue;
    }
    // r:/c: do not take dotted accessors in practice; keep plain as prefix:spec.
    const plain = prefix === 'e' ? `e:${spec}${accessor}` : `${prefix}:${spec}`;
    const startPos = offsetToPosition(content, lineStart + start);
    const endPos = offsetToPosition(content, lineStart + end);
    return {
      plain,
      prefix,
      range: new monaco.Range(
          startPos.line, startPos.column, endPos.line, endPos.column),
    };
  }
  return null;
}

export function formatTokenHoverValue(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Resolve the live/preview value for a plain `e:` / `r:` / `c:` token. */
export function resolveDynamicTokenHoverValue(plain: string): unknown {
  const trimmed = String(plain || '').trim();
  const envMatch = new RegExp(
      `^e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`, 'i').exec(trimmed);
  if (envMatch) {
    const name = envMatch[1];
    const accessor = envMatch[2] || '';
    if (!Object.prototype.hasOwnProperty.call(hoverEnvMap, name)) {
      return undefined;
    }
    return applyValueAccessor(hoverEnvMap[name], accessor);
  }
  const runtimeMatch = /^(r|c):(.+)$/i.exec(trimmed);
  if (!runtimeMatch) {
    return undefined;
  }
  const prefix = runtimeMatch[1].toLowerCase();
  const spec = runtimeMatch[2];
  if (prefix === 'c') {
    return currentValueForToken(spec);
  }
  return randomValueForToken(spec);
}

/** Register once per monaco instance: hover shows resolved e:/r:/c: values. */
export function registerTokenValueHover(monaco: any): void {
  if (!monaco?.languages?.registerHoverProvider) {
    return;
  }
  if (monaco.__mmtTokenValueHoverInstalled) {
    return;
  }
  monaco.__mmtTokenValueHoverInstalled = true;

  monaco.languages.registerHoverProvider('yaml', {
    provideHover: (model: any, position: any) => {
      if (!model || model.getLanguageId?.() !== 'yaml') {
        return null;
      }
      const content = model.getValue?.() || '';
      const target =
          getDynamicTokenTargetAtPosition(monaco, model, content, position);
      if (!target) {
        return null;
      }
      const resolved = resolveDynamicTokenHoverValue(target.plain);
      if (resolved === undefined) {
        return null;
      }
      const text = formatTokenHoverValue(resolved);
      if (!text) {
        return null;
      }
      // Fence so Monaco does not treat the value as markdown.
      const safe = text.replace(/```/g, '\\`\\`\\`');
      return {
        range: target.range,
        contents: [{value: '```\n' + safe + '\n```'}],
      };
    },
  });
}
