export type TokenPrefix = 'i' | 'e' | 'r' | 'c';

export interface TokenCompletionMatch {
  prefix: TokenPrefix | null;
  typed: string;
  /** 0-based index in tokenSource where the replacement starts (`i:` or after `<<`). */
  replaceFrom: number;
}

const ANGLE_PREFIX = /<<((?:i|e|r|c):)([\w-]*)$/;
const BARE_PREFIX = /(^|[\s"'`])((?:i|e|r|c):)([\w-]*)$/;
const ANGLE_OPEN = /<<([\w-]*)$/;

function asPrefix(raw: string): TokenPrefix | null {
  if (raw === 'i' || raw === 'e' || raw === 'r' || raw === 'c') {
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
