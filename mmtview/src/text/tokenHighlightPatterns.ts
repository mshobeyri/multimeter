import {
  TOKEN_NAME_RE,
  ACCESSOR_PATH_RE,
  DYNAMIC_KEY_RE,
} from 'mmt-core/variableReplacer';

const ENV_BRACE_TOKEN = `e:\\{${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}\\}`;

/** Full `<<...>>` tokens including parameterized `r:` / `c:` forms. */
export const INLINE_ANGLE_TOKEN_HIGHLIGHT_RE = new RegExp(
  `<<\\s*(${DYNAMIC_KEY_RE})\\s*>>`,
  'g'
);

/** Single-angle env form: `<e:NAME>`. */
export const INLINE_SINGLE_ANGLE_ENV_HIGHLIGHT_RE = new RegExp(
  `<\\s*(e:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE})\\s*>`,
  'g'
);

/** Plain tokens after YAML value colon-space, including `e:{NAME}`. */
export const PLAIN_TOKEN_HIGHLIGHT_RE = new RegExp(
  `:\\s(${DYNAMIC_KEY_RE}|${ENV_BRACE_TOKEN})`,
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
      if (token) {
        found.push(token);
      }
    }
  }

  return found;
}
