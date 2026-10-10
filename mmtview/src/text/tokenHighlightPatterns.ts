import {
  TOKEN_NAME_RE,
  ACCESSOR_PATH_RE,
} from 'mmt-core/variableReplacer';

/**
 * Highlight form of r:/c: — any keyword-shaped name + optional `(...)` args.
 * Unknown names still highlight; the validator warns separately (like i:/e:).
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

const RUNTIME_TOKEN_PREFIX_RE =
    /^(r|c):([A-Za-z_][A-Za-z0-9_-]*)/;

/**
 * Whether a captured token should get the editor highlight.
 * Allowed prefixes: r: / c: / e: / i: / o: (output keys).
 * Any well-formed r:/c: name highlights (same as i:/e:); unknown → warning.
 */
export function isHighlightableToken(token: string): boolean {
  const trimmed = String(token || '').trim();
  if (
    trimmed.startsWith('e:') ||
    trimmed.startsWith('i:') ||
    trimmed.startsWith('o:')
  ) {
    return true;
  }
  return RUNTIME_TOKEN_PREFIX_RE.test(trimmed);
}
/** Full `<<...>>` tokens including parameterized `r:` / `c:` forms. */
export const INLINE_ANGLE_TOKEN_HIGHLIGHT_RE = new RegExp(
  `<<\\s*(${DYNAMIC_KEY_HIGHLIGHT_RE})\\s*>>`,
  'g'
);

/** Curly form `{{e:name}}` — same tokens, same highlight. */
export const CURLY_TOKEN_HIGHLIGHT_RE = new RegExp(
  `\\{\\{\\s*(${DYNAMIC_KEY_HIGHLIGHT_RE})\\s*\\}\\}`,
  'g'
);

/**
 * Bare tokens highlight only as a whole YAML value:
 * `key: i:name` or `- r:uuid`, through the end of the line.
 */
const WHOLE_VALUE_PREFIX =
  `(?:^|\\n)[ \\t]*(?:-[ \\t]+|[A-Za-z_][\\w.-]*[ \\t]*:[ \\t]+)`;
const WHOLE_VALUE_SUFFIX = `(?=[ \\t]*(?:#.*)?(?:\\n|$))`;

/** Plain tokens that are the entire YAML value. */
export const PLAIN_TOKEN_HIGHLIGHT_RE = new RegExp(
  `${WHOLE_VALUE_PREFIX}(${DYNAMIC_KEY_HIGHLIGHT_RE})${WHOLE_VALUE_SUFFIX}`,
  'g'
);

/**
 * True when `offset` sits in a YAML block scalar (`|` / `>`).
 * Lines inside the block are one string, so a bare `i:name` there is not
 * its own value.
 */
export function isInsideYamlBlockScalar(content: string, offset: number): boolean {
  const text = String(content ?? '');
  const lines = text.split('\n');
  let pos = 0;
  let blockIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = pos + line.length + (i < lines.length - 1 ? 1 : 0);
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (offset < next || (i === lines.length - 1 && offset <= text.length)) {
      if (blockIndent < 0) {
        return false;
      }
      if (line.trim() === '') {
        return true;
      }
      return indent > blockIndent;
    }
    if (blockIndent >= 0 && line.trim() !== '' && indent <= blockIndent) {
      blockIndent = -1;
    }
    if (blockIndent < 0 && /^[ \t]*[^ \t#][^:]*:\s*[|>][+-]?\d*\s*(?:#.*)?$/.test(line)) {
      blockIndent = indent;
    }
    pos = next;
  }
  return false;
}

/** `o:name` keys used as YAML keys under `set`, etc. */
export const OUTPUT_KEY_TOKEN_HIGHLIGHT_RE = new RegExp(
  `(?:^|[\\s,{])(o:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE})(?=\\s*:)`,
  'gm'
);

export function collectTokenHighlightMatches(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    INLINE_ANGLE_TOKEN_HIGHLIGHT_RE,
    CURLY_TOKEN_HIGHLIGHT_RE,
    PLAIN_TOKEN_HIGHLIGHT_RE,
    OUTPUT_KEY_TOKEN_HIGHLIGHT_RE,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const token = match[1];
      if (!token || !isHighlightableToken(token)) {
        continue;
      }
      if (pattern === PLAIN_TOKEN_HIGHLIGHT_RE) {
        const tokenOffset = match.index + match[0].indexOf(token);
        if (isInsideYamlBlockScalar(text, tokenOffset)) {
          continue;
        }
      }
      found.push(token);
    }
  }

  return found;
}
