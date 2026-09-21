export type TokenPrefix = 'i' | 'e' | 'r' | 'c' | 'o';

export interface TokenCompletionMatch {
  prefix: TokenPrefix | null;
  typed: string;
  /** 0-based index in tokenSource where the replacement starts (`i:` or after `<<`). */
  replaceFrom: number;
}

const ANGLE_PREFIX = /<<((?:i|e|r|c|o):)([\w-]*)$/;
const BARE_PREFIX = /(^|[\s"'`/=&])((?:i|e|r|c|o):)([\w-]*)$/;
const ANGLE_OPEN = /<<([\w-]*)$/;

function asPrefix(raw: string): TokenPrefix | null {
  if (raw === 'i' || raw === 'e' || raw === 'r' || raw === 'c' || raw === 'o') {
    return raw;
  }
  return null;
}

/** Detect `<<i:name`, `i:name`, or a bare `<<` for token completions. */
export function matchTokenCompletion(tokenSource: string): TokenCompletionMatch | null {
  const source = String(tokenSource ?? '');
  const angle = source.match(ANGLE_PREFIX);
  if (angle) {
    const prefix = asPrefix(angle[1].slice(0, -1));
    return {
      prefix,
      typed: angle[2],
      replaceFrom: source.length - angle[1].length - angle[2].length,
    };
  }
  const bare = source.match(BARE_PREFIX);
  if (bare) {
    const prefix = asPrefix(bare[2].slice(0, -1));
    return {
      prefix,
      typed: bare[3],
      replaceFrom: source.length - bare[2].length - bare[3].length,
    };
  }
  const open = source.match(ANGLE_OPEN);
  if (open && !open[1].includes(':')) {
    return {
      prefix: null,
      typed: open[1],
      replaceFrom: source.length - open[1].length,
    };
  }
  return null;
}

/** True when the token sits inside other text and needs `<<i:name>>` form. */
export function needsBraceTokenForm(lineContent: string, replaceFrom: number): boolean {
  const before = lineContent.slice(0, replaceFrom);
  if (before.endsWith('<<')) {
    return true;
  }
  const colon = lineContent.indexOf(':');
  if (colon < 0) {
    return false;
  }
  let valueContentStart = colon + 1;
  while (valueContentStart < lineContent.length && lineContent[valueContentStart] === ' ') {
    valueContentStart++;
  }
  const beforeInValue = lineContent.slice(valueContentStart, replaceFrom);
  return beforeInValue.trim().length > 0;
}

export function formatTokenInsertText(
  prefix: TokenPrefix,
  name: string,
  lineContent: string,
  tokenMatch: TokenCompletionMatch,
): string {
  const token = `${prefix}:${name}`;
  const before = lineContent.slice(0, tokenMatch.replaceFrom);
  if (before.endsWith('<<')) {
    return `${token}>>`;
  }
  if (needsBraceTokenForm(lineContent, tokenMatch.replaceFrom)) {
    return `<<${token}>>`;
  }
  return token;
}
