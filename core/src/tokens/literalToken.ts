/**
 * YAML-quoted token scalars (`"r:uuid"`, `"i:user"`, …) stay literal text —
 * same idea as quoted `"omit"` vs bare `omit`.
 *
 * Unquoted `r:uuid` still resolves. Quoted `"r:uuid"` is wrapped at parse time
 * so replace/resolve leave the text unchanged, then unwrapped on YAML emit.
 */

/** Marks a YAML-quoted token scalar so resolve/replace leave it as plain text. */
export const LITERAL_TOKEN_PREFIX = '__MMT_LITERAL__:';

// Keep in sync with variableReplacer token shapes (avoid importing that module —
// it depends on this one for resolve skips).
const TOKEN_NAME_RE = '[A-Za-z_][A-Za-z0-9_\\-]*';
const ACCESSOR_SEGMENT_RE =
    '(?:\\.[A-Za-z_][A-Za-z0-9_]*|\\[(?:-?\\d+(?::-?\\d*)?|:-?\\d*|[A-Za-z_][A-Za-z0-9_]*)\\])';
const ACCESSOR_PATH_RE = `${ACCESSOR_SEGMENT_RE}*`;
const RANDOM_TOKEN_ARGUMENTS_RE =
    '\\(\\s*[^(),\\s]+(?:\\s*,\\s*[^(),\\s]+)?\\s*\\)';
const RANDOM_TOKEN_SPEC_RE =
    `${TOKEN_NAME_RE}(?:${RANDOM_TOKEN_ARGUMENTS_RE})?`;
const CURRENT_TOKEN_ARGUMENTS_RE =
    '\\([+-](?:\\d+(?:\\.\\d+)?(?:ms|s|m|h|d|w))+\\)';
const CURRENT_TOKEN_SPEC_RE =
    `${TOKEN_NAME_RE}(?:${CURRENT_TOKEN_ARGUMENTS_RE})?`;
/** Loose `(...)` so quoted `r:int(a,b)` / `c:date(x)` still count as token-like. */
const RUNTIME_ARGS_LOOSE_RE = '(?:\\([^)]*\\))?';
const RUNTIME_SPEC_RE = `${TOKEN_NAME_RE}${RUNTIME_ARGS_LOOSE_RE}`;

const DYNAMIC_KEY_RE =
    `(?:r:${RUNTIME_SPEC_RE}|c:${RUNTIME_SPEC_RE}|(?:e|i|o):${TOKEN_NAME_RE})` +
    ACCESSOR_PATH_RE;

const ANGLE_TOKEN_RE =
    new RegExp(`^<<\\s*(${DYNAMIC_KEY_RE})\\s*>>$`);

/** Whole `<<c:city>>` → `c:city`. Not a plain `c:city` or `{{c:city}}`. */
export function wholeAngleTokenPlain(value: string): string | null {
  const match = ANGLE_TOKEN_RE.exec(String(value ?? '').trim());
  if (!match) {
    return null;
  }
  return match[1].replace(/\s+/g, '');
}
const PLAIN_TOKEN_RE =
    new RegExp(`^(${DYNAMIC_KEY_RE})$`);
/** UI / Option C YAML alias: `{{i:x}}` / `{{r:uuid}}` / … */
const DISPLAY_CURLY_TOKEN_RE =
    new RegExp(`^\\{\\{\\s*(${DYNAMIC_KEY_RE})\\s*\\}\\}$`, 'i');
/** Quoted `<<token>>` after XML escaping, as echoed by an XML body. */
const XML_ESCAPED_ANGLE_RE =
    new RegExp(`^&lt;&lt;\\s*(${DYNAMIC_KEY_RE})\\s*&gt;&gt;$`, 'i');

/** Whole value is a bare `i:` / `e:` / `r:` / `c:` / `o:` token, not `{{…}}` or `<<…>>`. */
export function isPlainTokenScalar(value: string): boolean {
  return PLAIN_TOKEN_RE.test(String(value ?? ''));
}

/**
 * True when a whole scalar looks like an e:/i:/r:/c:/o: token (plain,
 * `<<…>>`, curly display form, or XML-escaped `&lt;&lt;…&gt;&gt;`).
 * Used to decide which quoted YAML values stay literal.
 * `<e:name>` and `e:{name}` are ordinary text.
 */
export function isTokenLikeScalar(value: string): boolean {
  const text = String(value ?? '');
  if (!text) {
    return false;
  }
  if (ANGLE_TOKEN_RE.test(text) || PLAIN_TOKEN_RE.test(text) ||
      DISPLAY_CURLY_TOKEN_RE.test(text) || XML_ESCAPED_ANGLE_RE.test(text)) {
    return true;
  }
  return false;
}

/**
 * `"i:xxx"` / `'r:uuid'` when the quote characters are part of the text
 * (input box, or a JSON/XML value saved back from the editor).
 * Returns the inner token, or null when this is not a quoted token.
 */
export function unwrapQuotedTokenText(value: string): string|null {
  const text = String(value ?? '').trim();
  if (text.length < 4) {
    return null;
  }
  const quote = text[0];
  if ((quote !== '"' && quote !== '\'') || text[text.length - 1] !== quote) {
    return null;
  }
  const inner = text.slice(1, -1);
  return isTokenLikeScalar(inner) ? inner : null;
}

export function isLiteralTokenValue(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(LITERAL_TOKEN_PREFIX);
}

export function wrapLiteralToken(value: string): string {
  if (isLiteralTokenValue(value)) {
    return value;
  }
  return LITERAL_TOKEN_PREFIX + value;
}

export function unwrapLiteralToken(value: string): string {
  if (!isLiteralTokenValue(value)) {
    return value;
  }
  return value.slice(LITERAL_TOKEN_PREFIX.length);
}

/** Deep-unwrap literal markers for YAML emit / logs (value becomes plain text). */
export function restoreLiteralTokens(value: any): any {
  if (isLiteralTokenValue(value)) {
    return unwrapLiteralToken(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => restoreLiteralTokens(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, restoreLiteralTokens(v)]));
  }
  return value;
}

/** Replace markers inside already-serialized text. */
export function restoreLiteralTokensInText(text: string): string {
  return String(text ?? '').split(LITERAL_TOKEN_PREFIX).join('');
}

/**
 * Walk a yaml AST: a quoted bare token (`"i:username"`, `"r:uuid"`) stays
 * text, the same way quoted `"omit"` stays the word omit.
 * Quoted `"<<i:username>>"` and `"{{i:username}}"` are not frozen. They
 * resolve like the unquoted forms.
 */
export function markQuotedTokenLiterals(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if ((node.type === 'QUOTE_DOUBLE' || node.type === 'QUOTE_SINGLE') &&
      typeof node.value === 'string' &&
      isPlainTokenScalar(node.value) &&
      !isLiteralTokenValue(node.value)) {
    node.value = wrapLiteralToken(node.value);
    return;
  }

  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      if (item && typeof item === 'object' &&
          Object.prototype.hasOwnProperty.call(item, 'key') &&
          Object.prototype.hasOwnProperty.call(item, 'value')) {
        markQuotedTokenLiterals(item.key);
        markQuotedTokenLiterals(item.value);
      } else {
        markQuotedTokenLiterals(item);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(node, 'key')) {
    markQuotedTokenLiterals(node.key);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'value')) {
    markQuotedTokenLiterals(node.value);
  }
}
