import {Current, Random} from 'mmt-core';
import {
  TOKEN_NAME_RE,
  ACCESSOR_PATH_RE,
} from 'mmt-core/variableReplacer';

const ENV_BRACE_TOKEN = `e:\\{${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}\\}`;

/**
 * Highlight form of r:/c: — known keyword name + any `(...)` args (not validated).
 * Runtime replacement still uses the stricter specs in variableReplacer.
 */
const RUNTIME_TOKEN_ARGS_LOOSE_RE = '(?:\\([^)]*\\))?';
const RUNTIME_TOKEN_HIGHLIGHT_SPEC_RE =
    `${TOKEN_NAME_RE}${RUNTIME_TOKEN_ARGS_LOOSE_RE}`;
const RUNTIME_TOKEN_HIGHLIGHT_RE =
    `(?:r|c):${RUNTIME_TOKEN_HIGHLIGHT_SPEC_RE}${ACCESSOR_PATH_RE}`;

/** Env / input tokens only — never arbitrary `x:name` prefixes. */
const ENV_INPUT_TOKEN_RE =
    `(?:e|i):${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}`;

/** Dynamic keys for editor highlight: r: / c: / e: / i: only. */
export const DYNAMIC_KEY_HIGHLIGHT_RE =
    `(?:${RUNTIME_TOKEN_HIGHLIGHT_RE}|${ENV_INPUT_TOKEN_RE})`;

const KNOWN_RANDOM_TOKENS = new Set(Object.keys(Random.RANDOM_TOKEN_MAP));
const KNOWN_CURRENT_TOKENS = new Set([
  ...Object.keys(Current.CURRENT_TOKEN_MAP),
  ...Object.keys(Current.CURRENT_FUTURE_PAST_ALIASES),
]);

const RUNTIME_TOKEN_PREFIX_RE =
    /^(r|c):([A-Za-z_][A-Za-z0-9_-]*)/;

/**
 * Whether a captured token should get the editor highlight.
 * Allowed prefixes: r: / c: (known keywords) / e: / i: / o: (output keys) / e:{…}.
 */
export function isHighlightableToken(token: string): boolean {
  const trimmed = String(token || '').trim();
  if (
    trimmed.startsWith('e:{') ||
    trimmed.startsWith('e:') ||
    trimmed.startsWith('i:') ||
    trimmed.startsWith('o:')
  ) {
    return true;
  }
  const match = RUNTIME_TOKEN_PREFIX_RE.exec(trimmed);
  if (!match) {
    return false;
  }
  const prefix = match[1];
  const name = match[2];
  if (prefix === 'r') {
    return KNOWN_RANDOM_TOKENS.has(name);
  }
  return KNOWN_CURRENT_TOKENS.has(name);
}

/** Full `<<...>>` tokens including parameterized `r:` / `c:` forms. */
export const INLINE_ANGLE_TOKEN_HIGHLIGHT_RE = new RegExp(
  `<<\\s*(${DYNAMIC_KEY_HIGHLIGHT_RE})\\s*>>`,
  'g'
);

/** Single-angle env form: `<e:NAME>`. */
export const INLINE_SINGLE_ANGLE_ENV_HIGHLIGHT_RE = new RegExp(
  `<\\s*(e:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE})\\s*>`,
  'g'
);

/** Plain tokens after YAML value colon-space, including `e:{NAME}`. */
export const PLAIN_TOKEN_HIGHLIGHT_RE = new RegExp(
  `:\\s(${DYNAMIC_KEY_HIGHLIGHT_RE}|${ENV_BRACE_TOKEN})`,
  'g'
);

/** `e:{NAME}` env brace form anywhere in the document. */
export const ENV_BRACE_TOKEN_HIGHLIGHT_RE = new RegExp(
  `(?<![A-Za-z0-9])(${ENV_BRACE_TOKEN})`,
  'g'
);

/** `o:name` keys used as YAML keys under `set`, etc. */
export const OUTPUT_KEY_TOKEN_HIGHLIGHT_RE = new RegExp(
  `(?:^|[\\s,{])(o:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE})(?=\\s*:)`,
  'gm'
);

export function collectTokenHighlightMatches(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    INLINE_ANGLE_TOKEN_HIGHLIGHT_RE,
    INLINE_SINGLE_ANGLE_ENV_HIGHLIGHT_RE,
    PLAIN_TOKEN_HIGHLIGHT_RE,
    ENV_BRACE_TOKEN_HIGHLIGHT_RE,
    OUTPUT_KEY_TOKEN_HIGHLIGHT_RE,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const token = match[1];
      if (token && isHighlightableToken(token)) {
        found.push(token);
      }
    }
  }

  return found;
}
