import {
  CURRENT_FUTURE_PAST_ALIASES,
  CURRENT_TOKEN_MAP,
  currentTokenValueType,
} from '../Current';
import {
  isLiteralTokenValue,
  isPlainTokenScalar,
  LITERAL_TOKEN_PREFIX,
  unwrapLiteralToken,
  unwrapQuotedTokenText,
  wrapLiteralToken,
} from '../literalToken';
import {isOmitSentinel, OMIT_SENTINEL} from '../omitKeyword';
import {randomTokenValueType} from '../Random';
import {
  ACCESSOR_PATH_RE,
  TOKEN_NAME_RE,
  applyValueAccessor,
  replaceAllRefs,
} from '../variableReplacer';
import {
  stringContainsRuntimeToken,
  type TextPositionRange,
} from '../runtimeTokenUi';

/** Loose `(...)` so display/parse accept any args on r:/c: keyword shapes. */
const RUNTIME_TOKEN_ARGS_LOOSE_RE = '(?:\\([^)]*\\))?';
const RUNTIME_TOKEN_SPEC_LOOSE_RE =
    `${TOKEN_NAME_RE}${RUNTIME_TOKEN_ARGS_LOOSE_RE}`;

const WHOLE_PLAIN_RUNTIME_RE = new RegExp(
    `^(r|c):(${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE}$`,
);
/** Legacy editor/YAML angle form still accepted on parse. */
const WHOLE_ANGLE_RUNTIME_RE = new RegExp(
    `^<<\\s*((?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})\\s*>>$`,
);
const ANGLE_RUNTIME_GLOBAL_RE = new RegExp(
    `<<\\s*((?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})\\s*>>`,
    'g',
);

/**
 * Tester UI display form (integrity): `{{r:uuid}}` / `{{c:date(+1d)}}` /
 * `{{i:user}}` / `{{e:token}}`. Same prefix:name shape as YAML tokens.
 */
const DISPLAY_PREFIXED_GLOBAL_RE =
    /\{\{\s*([ierceo]):((?:[^{}]|\([^)]*\))+?)\s*\}\}/gi;
const WHOLE_DISPLAY_PREFIXED_RE =
    /^\{\{\s*([ierceo]):((?:[^{}]|\([^)]*\))+?)\s*\}\}$/i;
/** Match a display token at the start of a string (for JSON unquoted scan). */
const DISPLAY_PREFIXED_AT_RE =
    /^\{\{\s*([ierceo]):((?:[^{}]|\([^)]*\))+?)\s*\}\}/i;

/**
 * Legacy long-form still accepted on parse only:
 * `{{random uuid}}` / `{{current date(+1d)}}`.
 */
const LEGACY_DISPLAY_RUNTIME_GLOBAL_RE =
    /\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}/gi;
const WHOLE_LEGACY_DISPLAY_RUNTIME_RE =
    /^\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}$/i;
const LEGACY_DISPLAY_RUNTIME_AT_RE =
    /^\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}/i;

/** Input/env angle forms in free text. */
const ANGLE_IE_GLOBAL_RE = new RegExp(
    `<<\\s*((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE})\\s*>>`,
    'g',
);
const WHOLE_ANGLE_IE_RE = new RegExp(
    `^<<\\s*((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE})\\s*>>$`,
);
/**
 * Unquoted YAML/plain-storage angle tokens in JSON text
 * (`<<i:yy>>`, `<<r:uuid>>`, …) — same scan as `{{…}}`.
 */
const ANGLE_PREFIXED_AT_RE = new RegExp(
    `^<<\\s*((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}|` +
        `(?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})\\s*>>`,
    'i',
);
const PLAIN_IE_GLOBAL_RE = new RegExp(
    `(?<![A-Za-z0-9_])((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE})(?![A-Za-z0-9_])`,
    'g',
);

const PLACEHOLDER_PREFIX = '__MMT_RT_';
const PLACEHOLDER_RE = new RegExp(`^${PLACEHOLDER_PREFIX}(\\d+)__$`);

function indexToPosition(text: string, index: number): {line: number, column: number} {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return {line, column};
}

function tokenKeyword(plainSpec: string): {prefix: string, name: string}|null {
  const m = /^(r|c):([A-Za-z_][A-Za-z0-9_-]*)/.exec(plainSpec.trim());
  if (!m) {
    return null;
  }
  return {prefix: m[1], name: m[2]};
}

/**
 * Optional maps used to decide JSON quoting for `{{i:…}}` / `{{e:…}}`.
 * Number/boolean resolved values → unquoted; everything else → quoted string.
 */
export type RuntimeTokenValueContext = {
  inputs?: Record<string, unknown>|null;
  env?: Record<string, unknown>|null;
};

function lookupIeResolvedValue(
    plainSpec: string,
    ctx?: RuntimeTokenValueContext,
): unknown {
  if (!ctx) {
    return undefined;
  }
  const m = new RegExp(
      `^(i|e):(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`,
      'i',
  ).exec(String(plainSpec ?? '').trim());
  if (!m) {
    return undefined;
  }
  const prefix = m[1].toLowerCase();
  const name = m[2];
  const accessor = m[3] || '';
  const map = prefix === 'i' ? ctx.inputs : ctx.env;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(map, name)) {
    return undefined;
  }
  return applyValueAccessor(
      (map as Record<string, unknown>)[name],
      accessor,
  );
}

/**
 * True when this token should appear as a JSON string (quoted) in the body
 * editor. False for number/bool (and null) so the token stays unquoted.
 *
 * - `r:` / `c:` — from generator return-type metadata (`randomTokenValueType` /
 *   `currentTokenValueType`).
 * - `i:` / `e:` — from `typeof` of the active inputs/env value when `ctx` is set;
 *   missing values default to string (quoted).
 */
export function runtimeTokenEmitsJsonString(
    plainSpec: string,
    ctx?: RuntimeTokenValueContext,
): boolean {
  const trimmed = String(plainSpec ?? '').trim();
  if (/^[ie]:/i.test(trimmed)) {
    const val = lookupIeResolvedValue(trimmed, ctx);
    if (val === undefined) {
      return true;
    }
    if (val === null || typeof val === 'number' || typeof val === 'boolean') {
      return false;
    }
    return true;
  }
  const parsed = tokenKeyword(trimmed);
  if (!parsed) {
    return true;
  }
  let name = parsed.name;
  if (parsed.prefix === 'r') {
    const t = randomTokenValueType(name);
    if (!t) {
      return true;
    }
    return t === 'string';
  }
  const alias = CURRENT_FUTURE_PAST_ALIASES[name];
  if (alias) {
    name = alias.base;
  }
  const t = currentTokenValueType(name);
  if (!t &&
      !Object.prototype.hasOwnProperty.call(CURRENT_TOKEN_MAP, name)) {
    return true;
  }
  return (t || 'string') === 'string';
}

/** True when the whole string is a bare resolving r:/c: token. */
export function isWholeBareRuntimeToken(value: string): boolean {
  if (!value || isLiteralTokenValue(value)) {
    return false;
  }
  if (!WHOLE_PLAIN_RUNTIME_RE.test(value)) {
    return false;
  }
  return stringContainsRuntimeToken(value);
}

/** True when the whole string is a YAML-quoted (literal) r:/c: token. */
export function isWholeLiteralRuntimeToken(value: string): boolean {
  if (!isLiteralTokenValue(value)) {
    return false;
  }
  const inner = unwrapLiteralToken(value);
  const fromDisplay = displayTokenToPlain(inner);
  if (fromDisplay) {
    return true;
  }
  if (WHOLE_ANGLE_RUNTIME_RE.test(inner)) {
    const plain = angleToPlain(inner);
    return plain !== null && stringContainsRuntimeToken(plain);
  }
  if (!WHOLE_PLAIN_RUNTIME_RE.test(inner)) {
    return false;
  }
  return stringContainsRuntimeToken(inner);
}

function angleToPlain(angled: string): string|null {
  const trimmed = angled.trim();
  const runtime = WHOLE_ANGLE_RUNTIME_RE.exec(trimmed);
  if (runtime) {
    return runtime[1];
  }
  const ie = WHOLE_ANGLE_IE_RE.exec(trimmed);
  return ie ? ie[1] : null;
}

/**
 * Display curly → plain token.
 * - `{{r:uuid}}` / `{{c:epoch_ms}}` / `{{i:user}}` / `{{e:token}}`
 * - Legacy: `{{random uuid}}` / `{{current epoch ms}}` → `r:uuid` / `c:epoch_ms`
 */
export function displayTokenToPlain(display: string): string|null {
  const trimmed = String(display ?? '').trim();
  const prefixed = WHOLE_DISPLAY_PREFIXED_RE.exec(trimmed);
  if (prefixed) {
    const prefix = prefixed[1].toLowerCase();
    const rest = prefixed[2].trim();
    if (!rest || !'ierceo'.includes(prefix)) {
      return null;
    }
    const plain = `${prefix}:${rest}`;
    if (prefix === 'r' || prefix === 'c') {
      return stringContainsRuntimeToken(plain) ? plain : null;
    }
    // i: / e: — accept any TOKEN_NAME-shaped rest (including accessors).
    return new RegExp(`^(?:i|e|o):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}$`)
               .test(plain) ?
        plain :
        null;
  }
  const legacy = WHOLE_LEGACY_DISPLAY_RUNTIME_RE.exec(trimmed);
  if (!legacy) {
    return null;
  }
  const prefix = legacy[1].toLowerCase() === 'random' ? 'r' : 'c';
  const rest = legacy[2].trim();
  const argStart = rest.search(/[(\[]/);
  const rawName = (argStart >= 0 ? rest.slice(0, argStart) : rest).trim();
  const args = argStart >= 0 ? rest.slice(argStart).trim() : '';
  const name = rawName.replace(/\s+/g, '_');
  if (!name) {
    return null;
  }
  const plain = `${prefix}:${name}${args}`;
  return stringContainsRuntimeToken(plain) ? plain : null;
}

/** Plain `r:uuid` / `<<i:user>>` / already-display → `{{r:uuid}}` / `{{i:user}}`. */
export function toDisplayRuntimeToken(value: string): string {
  const text = isLiteralTokenValue(value) ? unwrapLiteralToken(value) : value;
  const trimmed = text.trim();
  const already = displayTokenToPlain(trimmed);
  if (already) {
    return `{{${already}}}`;
  }
  const fromRcAngle = angleToPlain(trimmed);
  if (fromRcAngle && stringContainsRuntimeToken(fromRcAngle)) {
    return `{{${fromRcAngle}}}`;
  }
  if (WHOLE_PLAIN_RUNTIME_RE.test(trimmed) && stringContainsRuntimeToken(trimmed)) {
    return `{{${trimmed}}}`;
  }
  const ieAngle = WHOLE_ANGLE_IE_RE.exec(trimmed);
  if (ieAngle) {
    return `{{${ieAngle[1]}}}`;
  }
  if (new RegExp(`^(?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}$`).test(trimmed)) {
    return `{{${trimmed}}}`;
  }
  return trimmed;
}

/** @deprecated Use toDisplayRuntimeToken */
export const toAngleRuntimeToken = toDisplayRuntimeToken;

/** Plain `r:uuid` / `c:date` inside free text (not already `{{…}}` / `<<…>>`). */
const PLAIN_RUNTIME_GLOBAL_RE = new RegExp(
    `(?<![A-Za-z0-9_])((?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})(?![A-Za-z0-9_])`,
    'g',
);

/**
 * Rewrite r:/c: tokens in free text to `{{r:…}}` / `{{c:…}}`
 * (plain, `<<…>>`, legacy long-form, or already-display). Does **not** rewrite
 * i:/e: (preview keeps those as resolved values).
 */
export function rewriteRuntimeTokensInText(text: string): string {
  let out = String(text ?? '');
  out = out.replace(LEGACY_DISPLAY_RUNTIME_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain && (plain.startsWith('r:') || plain.startsWith('c:')) ?
        toDisplayRuntimeToken(plain) :
        match;
  });
  out = out.replace(DISPLAY_PREFIXED_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain && (plain.startsWith('r:') || plain.startsWith('c:')) ?
        toDisplayRuntimeToken(plain) :
        match;
  });
  out = out.replace(ANGLE_RUNTIME_GLOBAL_RE, (_match, plain: string) => {
    if (!stringContainsRuntimeToken(plain)) {
      return _match;
    }
    return toDisplayRuntimeToken(plain);
  });
  out = out.replace(PLAIN_RUNTIME_GLOBAL_RE, (match, plain: string, offset: number) => {
    if (!stringContainsRuntimeToken(plain)) {
      return match;
    }
    // Bare r:/c: is a token only when it is the entire value.
    if (out.trim() !== plain) {
      return match;
    }
    // Do not rematch `r:…` / `c:…` already inside `{{r:…}}` / `{{c:…}}`.
    if (offset >= 2 && out.slice(offset - 2, offset) === '{{') {
      return match;
    }
    return toDisplayRuntimeToken(plain);
  });
  return out;
}

/**
 * Rewrite i:/e:/r:/c: tokens to uniform `{{prefix:…}}` for the edit buffer.
 */
export function rewriteAllTokensToDisplayText(text: string): string {
  let out = rewriteRuntimeTokensInText(text);
  out = out.replace(DISPLAY_PREFIXED_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain ? toDisplayRuntimeToken(plain) : match;
  });
  out = out.replace(ANGLE_IE_GLOBAL_RE, (_match, plain: string) => {
    return toDisplayRuntimeToken(plain);
  });
  out = out.replace(PLAIN_IE_GLOBAL_RE, (match, plain: string, offset: number) => {
    // Bare i:/e: is a token only when it is the entire value.
    if (out.trim() !== plain) {
      return match;
    }
    // Do not rematch `i:…` / `e:…` already inside `{{i:…}}` / `{{e:…}}`.
    if (offset >= 2 && out.slice(offset - 2, offset) === '{{') {
      return match;
    }
    return toDisplayRuntimeToken(plain);
  });
  return out;
}

/**
 * Convert body-editor display tokens to resolvable `<<…>>`
 * so Send / runner replaceAllRefs can expand them.
 */
export function displayRuntimeTokensToResolvableText(text: string): string {
  let out = String(text ?? '');
  out = out.replace(LEGACY_DISPLAY_RUNTIME_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain ? `<<${plain}>>` : match;
  });
  out = out.replace(DISPLAY_PREFIXED_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain ? `<<${plain}>>` : match;
  });
  return out;
}

/**
 * Keep r:/c: markers from YAML `source` while taking resolved e:/i:/static
 * leaves from `resolved` (the live preview object).
 */
export function projectBodyKeepingRuntimeTokens(
    source: unknown,
    resolved: unknown,
): unknown {
  if (typeof source === 'string') {
    if (isWholeBareRuntimeToken(source) || isWholeLiteralRuntimeToken(source)) {
      return source;
    }
    if (stringContainsRuntimeToken(source) ||
        (isLiteralTokenValue(source) &&
         stringContainsRuntimeToken(unwrapLiteralToken(source)))) {
      return source;
    }
    if (displayTokenToPlain(source) || angleToPlain(source.trim())) {
      return source;
    }
  }
  if (Array.isArray(source) && Array.isArray(resolved)) {
    const n = Math.min(source.length, resolved.length);
    const out: unknown[] = [];
    for (let i = 0; i < n; i++) {
      out.push(projectBodyKeepingRuntimeTokens(source[i], resolved[i]));
    }
    for (let i = n; i < resolved.length; i++) {
      out.push(resolved[i]);
    }
    return out;
  }
  if (
    source && typeof source === 'object' && !Array.isArray(source) &&
    resolved && typeof resolved === 'object' && !Array.isArray(resolved)
  ) {
    const srcObj = source as Record<string, unknown>;
    const resObj = resolved as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(resObj)) {
      if (Object.prototype.hasOwnProperty.call(srcObj, key)) {
        out[key] = projectBodyKeepingRuntimeTokens(srcObj[key], resObj[key]);
      } else {
        out[key] = resObj[key];
      }
    }
    return out;
  }
  return resolved;
}

/**
 * Rewrite whole-value r:/c: leaves to display text for XML / urlencoded / text
 * (`{{r:uuid}}`). Quotes are a JSON concern only. Does **not** rewrite i:/e:
 * (preview keeps those resolved).
 */
export function rewriteRuntimeLeavesToDisplayText(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isLiteralTokenValue(value)) {
      return unwrapLiteralToken(value);
    }
    if (isWholeBareRuntimeToken(value) ||
        displayTokenToPlain(value) || angleToPlain(value.trim())) {
      return toDisplayRuntimeToken(value);
    }
    if (stringContainsRuntimeToken(value) || DISPLAY_PREFIXED_GLOBAL_RE.test(value) ||
        LEGACY_DISPLAY_RUNTIME_GLOBAL_RE.test(value)) {
      DISPLAY_PREFIXED_GLOBAL_RE.lastIndex = 0;
      LEGACY_DISPLAY_RUNTIME_GLOBAL_RE.lastIndex = 0;
      return rewriteRuntimeTokensInText(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteRuntimeLeavesToDisplayText(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          rewriteRuntimeLeavesToDisplayText(v),
        ]),
    );
  }
  return value;
}

/**
 * Edit-buffer projection: every i:/e:/r:/c: leaf becomes `{{prefix:…}}`.
 */
export function rewriteAllLeavesToDisplayText(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isLiteralTokenValue(value)) {
      return value;
    }
    const trimmed = value.trim();
    const converted = toDisplayRuntimeToken(trimmed);
    if (converted !== trimmed || displayTokenToPlain(trimmed)) {
      return converted;
    }
    return rewriteAllTokensToDisplayText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAllLeavesToDisplayText(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          rewriteAllLeavesToDisplayText(v),
        ]),
    );
  }
  return value;
}

/** @deprecated Use rewriteRuntimeLeavesToDisplayText */
export const rewriteRuntimeLeavesToAngleText = rewriteRuntimeLeavesToDisplayText;

/**
 * After packing XML/urlencoded/text structures, turn display (or legacy
 * angle) tokens back into bare `r:…` / `c:…` (whole value) or `<<r:…>>`
 * (embedded in larger text) for YAML / resolve.
 */
export function reviveDisplayRuntimeTokensInValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // YAML-quoted token scalars stay literal (do not rewrite {{…}} inside).
    if (isLiteralTokenValue(value)) {
      return value;
    }
    // Editor text `"i:xxx"` / `'r:uuid'` is quoted text, same as YAML quotes.
    const quotedToken = unwrapQuotedTokenText(value);
    if (quotedToken) {
      return wrapLiteralToken(quotedToken);
    }
    const trimmed = value.trim();
    if (WHOLE_DISPLAY_PREFIXED_RE.test(trimmed) ||
        WHOLE_LEGACY_DISPLAY_RUNTIME_RE.test(trimmed) ||
        WHOLE_ANGLE_RUNTIME_RE.test(trimmed) ||
        WHOLE_ANGLE_IE_RE.test(trimmed)) {
      const fromDisplay = displayTokenToPlain(trimmed);
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromAngle = angleToPlain(trimmed);
      if (fromAngle) {
        // Whole-value <<i:>> / <<e:>> / known <<r:>> / <<c:>> → bare YAML token.
        if (/^[ie]:/i.test(fromAngle) || stringContainsRuntimeToken(fromAngle)) {
          return fromAngle;
        }
      }
    }
    return displayRuntimeTokensToResolvableText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveDisplayRuntimeTokensInValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          reviveDisplayRuntimeTokensInValue(v),
        ]),
    );
  }
  return value;
}

/** @deprecated Use reviveDisplayRuntimeTokensInValue */
export const reviveAngleRuntimeTokensInValue = reviveDisplayRuntimeTokensInValue;

/**
 * Editor body text → model. A whole leaf `i:xxx` was inside JSON/XML quotes,
 * so it stays quoted text. `{{i:xxx}}` and `<<i:xxx>>` stay live tokens.
 * YAML parse does not use this — a bare YAML token must stay live.
 */
export function reviveEditorBodyValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isLiteralTokenValue(value)) {
      return value;
    }
    if (isPlainTokenScalar(value)) {
      return wrapLiteralToken(value);
    }
    return reviveDisplayRuntimeTokensInValue(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveEditorBodyValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          reviveEditorBodyValue(v),
        ]),
    );
  }
  return value;
}

/**
 * Parse XML (or XML-like editor text) and revive `{{random …}}` leaves to
 * bare `r:`/`c:` markers. `{{}}` is valid in XML text, so no placeholders.
 */
export function parseXmlTextWithRuntimeTokens(
    text: string,
    parseXml: (xml: string) => unknown,
): unknown {
  const parsed = parseXml(text);
  return reviveEditorBodyValue(parsed);
}

/** No-op for `{{}}` (kept for call-site compatibility). */
export function unescapeAngleRuntimeTokensInXml(xml: string): string {
  return xml;
}

/**
 * URLSearchParams percent-encodes `{{r:uuid}}` (and legacy `{{random uuid}}`).
 * Restore known display tokens so the urlencoded editor keeps readable `{{…}}`.
 */
export function restoreAngleRuntimeTokensInUrlEncoded(text: string): string {
  // URLSearchParams encodes `{{` / `}}` / `:` as %7B%7B / %7D%7D / %3A.
  // A quoted literal keeps its marker, so do not turn that token back into
  // a resolving `{{…}}`.
  const encodedPrefix = encodeURIComponent(LITERAL_TOKEN_PREFIX);
  return String(text ?? '').replace(
      /%7B%7B(?:(?:random|current)(?:[A-Za-z0-9_\-().+\s]|%[0-9A-Fa-f]{2})*|[ierceo](?::|%3A)(?:[A-Za-z0-9_\-().+,]|%[0-9A-Fa-f]{2})*)%7D%7D/gi,
      (match, offset: number, source: string) => {
        if (source.slice(offset - encodedPrefix.length, offset) === encodedPrefix) {
          return match;
        }
        try {
          const decoded = decodeURIComponent(match.replace(/\+/g, '%20'));
          const plain = displayTokenToPlain(decoded);
          return plain ? toDisplayRuntimeToken(plain) : match;
        } catch {
          return match;
        }
      },
  );
}

/** Validate XML; `{{…}}` tokens are normal text. */
export function isXmlWithRuntimeTokensValid(
    text: string,
    parseXml: (xml: string) => unknown,
): boolean {
  if (text.trim() === '') {
    return true;
  }
  try {
    parseXml(text);
    return true;
  } catch {
    return false;
  }
}

function plainTokenFromLeaf(value: string): string|null {
  const trimmed = value.trim();
  const fromDisplay = displayTokenToPlain(trimmed);
  if (fromDisplay) {
    return fromDisplay;
  }
  const fromRcAngle = angleToPlain(trimmed);
  if (fromRcAngle) {
    return fromRcAngle;
  }
  if (isWholeBareRuntimeToken(trimmed)) {
    return trimmed;
  }
  const ie = new RegExp(
      `^(?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}$`,
      'i',
  ).exec(trimmed);
  if (ie) {
    return trimmed;
  }
  const ieAngle = new RegExp(
      `^<<\\s*((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE})\\s*>>$`,
      'i',
  ).exec(trimmed);
  return ieAngle ? ieAngle[1] : null;
}

/** True when the leaf is still the token text, not a substituted value. */
function isUnresolvedTokenLeaf(plain: string, resolvedLeaf: unknown): boolean {
  if (typeof resolvedLeaf !== 'string') {
    return false;
  }
  const leaf = resolvedLeaf.trim();
  return leaf === plain ||
      leaf === `{{${plain}}}` ||
      leaf === `<<${plain}>>`;
}

function jsonLeafIsString(val: unknown): boolean {
  if (val === null || typeof val === 'number' || typeof val === 'boolean') {
    return false;
  }
  return true;
}

/**
 * Quote i:/e: from the live inputs/env type when that value is known.
 * A leaf that is still the token text (`e:name`) is not a string value.
 * Otherwise use the resolved leaf, then default to a string.
 */
function tokenEmitsJsonStringForLeaf(
    plain: string,
    resolvedLeaf: unknown,
    ctx?: RuntimeTokenValueContext,
    forceBarePlains?: ReadonlySet<string>,
): boolean {
  if (/^[ie]:/i.test(plain)) {
    const fromCtx = lookupIeResolvedValue(plain, ctx);
    if (fromCtx !== undefined) {
      return jsonLeafIsString(fromCtx);
    }
    if (resolvedLeaf !== undefined && !isUnresolvedTokenLeaf(plain, resolvedLeaf)) {
      return jsonLeafIsString(resolvedLeaf);
    }
  }
  // Beautify round-trip without ctx: keep i:/e: unquoted when source was bare.
  if (forceBarePlains && forceBarePlains.has(plain) && /^[ie]:/i.test(plain)) {
    return false;
  }
  return runtimeTokenEmitsJsonString(plain, ctx);
}

function jsonFormForRuntimePlain(
    plain: string,
    ctx?: RuntimeTokenValueContext,
    resolvedLeaf?: unknown,
    forceBarePlains?: ReadonlySet<string>,
): string {
  const display = toDisplayRuntimeToken(plain);
  if (tokenEmitsJsonStringForLeaf(plain, resolvedLeaf, ctx, forceBarePlains)) {
    return JSON.stringify(display);
  }
  return display;
}

function isIdentChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

/** Unquoted JSON `omit` is the keyword, same as YAML. Quoted `"omit"` stays text. */
function mapUnquotedOmitKeywords(
    text: string,
    onOmit: () => string,
): string {
  let out = '';
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (text.startsWith('omit', i) &&
        !isIdentChar(i > 0 ? text[i - 1] : undefined) &&
        !isIdentChar(text[i + 4])) {
      out += onOmit();
      i += 4;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function writeJsonWithRuntimeTokens(
    value: unknown,
    space: number,
    level: number,
    ctx?: RuntimeTokenValueContext,
    resolvedHint?: unknown,
    forceBarePlains?: ReadonlySet<string>,
    keepLiteralMarkers = false,
): string {
  if (isOmitSentinel(value)) {
    return 'omit';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  if (typeof value === 'string') {
    if (isLiteralTokenValue(value)) {
      return JSON.stringify(
          keepLiteralMarkers ? value : unwrapLiteralToken(value));
    }
    const plain = plainTokenFromLeaf(value);
    if (plain && (stringContainsRuntimeToken(plain) || /^[ie]:/i.test(plain))) {
      return jsonFormForRuntimePlain(plain, ctx, resolvedHint, forceBarePlains);
    }
    if (isWholeLiteralRuntimeToken(value)) {
      return JSON.stringify(toDisplayRuntimeToken(value));
    }
    return JSON.stringify(rewriteRuntimeTokensInText(value));
  }
  if (Array.isArray(value)) {
    const hintArr = Array.isArray(resolvedHint) ? resolvedHint : undefined;
    if (value.length === 0) {
      return '[]';
    }
    if (space <= 0) {
      return `[${
        value
            .map((item, i) => writeJsonWithRuntimeTokens(
                item, 0, 0, ctx, hintArr ? hintArr[i] : undefined,
                forceBarePlains, keepLiteralMarkers))
            .join(',')
      }]`;
    }
    const innerIndent = ' '.repeat(space * (level + 1));
    const outerIndent = ' '.repeat(space * level);
    const parts = value.map(
        (item, i) => `${innerIndent}${
          writeJsonWithRuntimeTokens(
              item, space, level + 1, ctx, hintArr ? hintArr[i] : undefined,
              forceBarePlains, keepLiteralMarkers)}`,
    );
    return `[\n${parts.join(',\n')}\n${outerIndent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const hintObj =
        resolvedHint && typeof resolvedHint === 'object' &&
            !Array.isArray(resolvedHint) ?
          resolvedHint as Record<string, unknown> :
          undefined;
    if (entries.length === 0) {
      return '{}';
    }
    if (space <= 0) {
      return `{${
        entries
            .map(([k, v]) =>
              `${JSON.stringify(k)}:${
                writeJsonWithRuntimeTokens(
                    v, 0, 0, ctx, hintObj ? hintObj[k] : undefined,
                    forceBarePlains, keepLiteralMarkers)}`)
            .join(',')
      }}`;
    }
    const innerIndent = ' '.repeat(space * (level + 1));
    const outerIndent = ' '.repeat(space * level);
    const parts = entries.map(
        ([k, v]) =>
          `${innerIndent}${JSON.stringify(k)}: ${
            writeJsonWithRuntimeTokens(
                v, space, level + 1, ctx, hintObj ? hintObj[k] : undefined,
                forceBarePlains, keepLiteralMarkers)}`,
    );
    return `{\n${parts.join(',\n')}\n${outerIndent}}`;
  }
  return 'null';
}

/**
 * Pretty/compact JSON: string tokens as `"{{r:uuid}}"`, number/bool as
 * bare `{{r:int}}` / `{{i:yy}}` (from resolved leaf type and/or value context).
 * `forceBarePlains` keeps listed i:/e: tokens unquoted (beautify round-trip).
 */
export function stringifyJsonWithRuntimeTokens(
    value: unknown,
    pretty: boolean = true,
    ctx?: RuntimeTokenValueContext,
    resolvedHint?: unknown,
    forceBarePlains?: ReadonlySet<string>,
    keepLiteralMarkers = false,
): string {
  return writeJsonWithRuntimeTokens(
      value, pretty ? 2 : 0, 0, ctx, resolvedHint, forceBarePlains,
      keepLiteralMarkers);
}

/**
 * Replace unquoted `{{…}}` / `<<…>>` runtime tokens outside JSON strings.
 * `onToken` receives the plain `i:` / `e:` / `r:` / `c:` spec.
 */
export function mapUnquotedDisplayRuntimeTokens(
    text: string,
    onToken: (plainSpec: string) => string,
): string {
  let out = '';
  let i = 0;
  let inString = false;
  let escape = false;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '{' && text.startsWith('{{', i)) {
      const slice = text.slice(i);
      const m = DISPLAY_PREFIXED_AT_RE.exec(slice) ||
          LEGACY_DISPLAY_RUNTIME_AT_RE.exec(slice);
      if (m) {
        const plain = displayTokenToPlain(m[0]);
        if (plain) {
          out += onToken(plain);
          i += m[0].length;
          continue;
        }
      }
    }
    // Plain-storage YAML bodies keep unquoted <<i:yy>> / <<r:int>> in JSON.
    if (ch === '<' && text.startsWith('<<', i)) {
      const m = ANGLE_PREFIXED_AT_RE.exec(text.slice(i));
      if (m && m[1]) {
        out += onToken(m[1]);
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** @deprecated Use mapUnquotedDisplayRuntimeTokens */
export const mapUnquotedAngleRuntimeTokens = mapUnquotedDisplayRuntimeTokens;

function reviveRuntimeTokenPlaceholders(
    value: unknown,
    map: string[],
): unknown {
  if (typeof value === 'string') {
    const placeholder = PLACEHOLDER_RE.exec(value);
    if (placeholder) {
      return map[Number(placeholder[1])] ?? value;
    }
    // A JSON string whose whole value is i:xxx was written as "i:xxx".
    // That is quoted text. {{i:xxx}} still revives to a live token below.
    if (isPlainTokenScalar(value)) {
      return wrapLiteralToken(value);
    }
    return reviveDisplayRuntimeTokensInValue(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveRuntimeTokenPlaceholders(item, map));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          reviveRuntimeTokenPlaceholders(v, map),
        ]),
    );
  }
  return value;
}

/**
 * Parse JSON that may contain unquoted `{{random …}}` / `{{current …}}`.
 * Quoted or bare whole-value display tokens revive to plain `r:…` / `c:…`.
 */
export function parseJsonWithRuntimeTokens(text: string): unknown {
  const map: string[] = [];
  const withOmit = mapUnquotedOmitKeywords(text, () => {
    const id = map.length;
    map.push(OMIT_SENTINEL);
    return `"${PLACEHOLDER_PREFIX}${id}__"`;
  });
  const replaced = mapUnquotedDisplayRuntimeTokens(withOmit, (plain) => {
    const id = map.length;
    map.push(plain);
    return `"${PLACEHOLDER_PREFIX}${id}__"`;
  });
  const parsed = JSON.parse(replaced);
  return reviveRuntimeTokenPlaceholders(parsed, map);
}

/** Validate JSON allowing unquoted display runtime tokens. */
export function isJsonWithRuntimeTokensValid(text: string): boolean {
  if (text.trim() === '') {
    return true;
  }
  try {
    const replaced = mapUnquotedDisplayRuntimeTokens(text, () => 'null');
    JSON.parse(replaced);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find highlight ranges for `{{r:…}}` / `{{c:…}}` / `{{i:…}}` / `{{e:…}}`
 * (and legacy `{{random …}}` / `{{current …}}`) in body text.
 */
export function findDisplayRuntimeTokenRanges(text: string): TextPositionRange[] {
  if (!text) {
    return [];
  }
  const ranges: TextPositionRange[] = [];
  const patterns = [DISPLAY_PREFIXED_GLOBAL_RE, LEGACY_DISPLAY_RUNTIME_GLOBAL_RE];
  for (const base of patterns) {
    const re = new RegExp(base.source, 'gi');
    let match: RegExpExecArray|null;
    while ((match = re.exec(text)) !== null) {
      if (!displayTokenToPlain(match[0])) {
        continue;
      }
      const start = indexToPosition(text, match.index);
      const end = indexToPosition(text, match.index + match[0].length);
      ranges.push({
        startLineNumber: start.line,
        startColumn: start.column,
        endLineNumber: end.line,
        endColumn: end.column,
      });
    }
  }
  return ranges;
}

/** @deprecated Use findDisplayRuntimeTokenRanges */
export const findAngleRuntimeTokenRanges = findDisplayRuntimeTokenRanges;

/**
 * Tester UI string for a single field (preview):
 * - Prefer YAML `source` r:/c: markers as `{{r:…}}` / `{{c:…}}`
 * - Otherwise show `resolved` as-is (so idle preview shows resolved input/env)
 * Quoted YAML literals stay literal.
 */
export function displayRuntimeString(
    resolved: unknown,
    source?: unknown,
): string {
  if (typeof source === 'string') {
    if (isLiteralTokenValue(source)) {
      return `"${unwrapLiteralToken(source)}"`;
    }
    // Preview keeps r:/c: as display tokens; i:/e: use resolved values.
    const angled = angleToPlain(source.trim());
    if (stringContainsRuntimeToken(source) || displayTokenToPlain(source) ||
        (angled != null && stringContainsRuntimeToken(angled))) {
      return rewriteRuntimeTokensInText(source);
    }
  }
  if (typeof resolved === 'string') {
    if (isLiteralTokenValue(resolved)) {
      return `"${unwrapLiteralToken(resolved)}"`;
    }
    const rewritten = rewriteAllTokensToDisplayText(resolved);
    // A missing token's value is the plain text (`i:name`). Do not show that
    // fallback as the editor form `{{i:name}}`.
    if (displayTokenToPlain(rewritten.trim()) === resolved.trim()) {
      return resolved;
    }
    return rewritten;
  }
  if (resolved == null) {
    return '';
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') {
    return String(resolved);
  }
  try {
    return JSON.stringify(resolved);
  } catch {
    return String(resolved);
  }
}

/**
 * Full YAML/source template projected to edit-buffer display tokens
 * (`{{i:…}}` / `{{e:…}}` / `{{r:…}}` / `{{c:…}}`).
 */
export function sourceToDisplayTokenTemplate(source: unknown): string {
  if (source == null) {
    return '';
  }
  if (typeof source === 'string') {
    if (isLiteralTokenValue(source)) {
      return `"${unwrapLiteralToken(source)}"`;
    }
    return rewriteAllTokensToDisplayText(source);
  }
  if (typeof source === 'object') {
    try {
      return JSON.stringify(rewriteAllLeavesToDisplayText(source));
    } catch {
      return rewriteAllTokensToDisplayText(String(source));
    }
  }
  return rewriteAllTokensToDisplayText(String(source));
}

/**
 * While typing, wrap a bare `i:` / `e:` / `r:` / `c:` token when it is the
 * entire value. `i:x` becomes `{{i:x}}` and the caret stays just after `x`.
 * Mixed text (`Bearer i:x`, `"i:x"`) stays literal — embed those with `<<…>>`.
 * Tokens already inside `{{…}}` or `<<…>>` are left alone.
 */
export function wrapTypedTokenAtCursor(
    text: string,
    cursor: number,
): {text: string, cursor: number} {
  const source = String(text ?? '');
  const rawCaret = Number.isFinite(cursor) ? cursor : source.length;
  const caret = Math.max(0, Math.min(rawCaret, source.length));
  const re = new RegExp(
      `(?<![A-Za-z0-9_{<])([riec]):(${TOKEN_NAME_RE}(?:\\([^)]*\\))?${ACCESSOR_PATH_RE})`,
      'g',
  );
  let match: RegExpExecArray|null;
  while ((match = re.exec(source)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const afterColon = start + match[1].length + 1;
    // Need at least one character after the colon, and the caret in that name.
    if (caret <= afterColon || caret > end) {
      continue;
    }
    // Only the whole value is a bare token.
    if (source.trim() !== match[0]) {
      continue;
    }
    const wrapped =
        source.slice(0, start) + '{{' + match[0] + '}}' + source.slice(end);
    return {text: wrapped, cursor: caret + 2};
  }
  return {text: source, cursor: caret};
}

/**
 * Map a single-field edit from preview text onto the token template.
 * Falls back to the template when positions cannot be transferred (typical
 * when resolved lengths differ from `{{i:…}}` / `{{e:…}}`).
 */
export function enterEditStringBuffer(
    preview: string,
    edited: string,
    yamlSource: unknown,
): string {
  const template = sourceToDisplayTokenTemplate(yamlSource);
  if (edited === preview) {
    return template;
  }
  // Already showing the template — keep the user's edit.
  if (preview === template) {
    return edited;
  }
  // Large replace / paste into preview: keep edited text, normalize tokens.
  if (Math.abs(edited.length - preview.length) > 1) {
    return rewriteAllTokensToDisplayText(edited);
  }
  // First keystroke: enter edit mode on the template (key consumed as switch).
  return template;
}

/**
 * Enter edit mode for a string record (headers / query / cookies / …).
 * Untouched keys become display-token templates from YAML `source`.
 */
export function enterEditStringRecord(
    preview: Record<string, string>,
    edited: Record<string, string>,
    yamlSource?: Record<string, unknown>|null,
): Record<string, string> {
  const src = yamlSource && typeof yamlSource === 'object' ? yamlSource : {};
  const out: Record<string, string> = {};
  const keys = new Set([...Object.keys(edited), ...Object.keys(preview)]);
  for (const key of keys) {
    const next = edited[key];
    if (next === undefined) {
      continue;
    }
    const prev = preview[key] ?? '';
    const srcVal = Object.prototype.hasOwnProperty.call(src, key) ?
      src[key] :
      undefined;
    if (srcVal === undefined) {
      out[key] = next;
      continue;
    }
    out[key] = enterEditStringBuffer(prev, next, srcVal);
  }
  return out;
}

/**
 * True when a field string contains any i:/e:/r:/c: token
 * (display `{{}}`, angle `<<>>`, or bare forms).
 */
export function stringContainsFieldToken(value: unknown): boolean {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  if (isLiteralTokenValue(value)) {
    return stringContainsFieldToken(unwrapLiteralToken(value));
  }
  if (displayTokenToPlain(value.trim())) {
    return true;
  }
  if (stringContainsRuntimeToken(value)) {
    return true;
  }
  const angledIe = new RegExp(ANGLE_IE_GLOBAL_RE.source, 'g');
  if (angledIe.test(value)) {
    return true;
  }
  const displayRe = new RegExp(DISPLAY_PREFIXED_GLOBAL_RE.source, 'gi');
  let match: RegExpExecArray|null;
  while ((match = displayRe.exec(value)) !== null) {
    if (displayTokenToPlain(match[0])) {
      return true;
    }
  }
  return new RegExp(
             `^(?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}$`,
             )
             .test(value.trim());
}

export type TokenFieldSpanKind = 'resolved'|'token';

export type TokenFieldSpan = {
  start: number;
  end: number;
  kind: TokenFieldSpanKind;
  /**
   * Hover label: display token (`{{i:name}}`) when `kind` is `resolved`,
   * or the resolved value when `kind` is `token`.
   */
  tooltip?: string;
};

/** Monaco-style range plus optional hover tooltip for body token underlines. */
export type BodyTokenHoverRange = TextPositionRange & {
  kind: TokenFieldSpanKind;
  tooltip?: string;
};

function ieResolvedToDisplayText(resolved: unknown): string {
  if (resolved === undefined) {
    return '';
  }
  if (isOmitSentinel(resolved)) {
    return 'omit';
  }
  if (resolved === null) {
    return 'null';
  }
  if (typeof resolved === 'string') {
    if (isLiteralTokenValue(resolved)) {
      return `"${unwrapLiteralToken(resolved)}"`;
    }
    // Nested tokens (i:age → r:int) use UI display form, not bare YAML.
    return rewriteAllTokensToDisplayText(resolved);
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') {
    return String(resolved);
  }
  try {
    return JSON.stringify(resolved);
  } catch {
    return String(resolved);
  }
}

/** Resolve a bare `r:…` / `c:…` token for idle field preview. */
function lookupRuntimeResolvedValue(plainSpec: string): unknown {
  const trimmed = String(plainSpec ?? '').trim();
  if (!/^[rc]:/i.test(trimmed) || !stringContainsRuntimeToken(trimmed)) {
    return undefined;
  }
  try {
    const out = replaceAllRefs(
        {v: `<<${trimmed}>>`},
        {},
        {},
        {},
        new Set(),
        {resolveRuntimeTokens: true},
    );
    return out?.v;
  } catch {
    return undefined;
  }
}

/**
 * Frozen runtime samples for telescope field preview.
 * Keyed by field display/source string → r: (and optional seeded c:) values
 * in encounter order. Cleared on telescope-on / open; replaced by seed after
 * a coherent resolve or Send (wire values).
 */
type TokenFieldPreviewCacheEntry = {
  r: unknown[];
  /** When set, `c:` uses these instead of live current values. */
  c?: unknown[];
};

const tokenFieldPreviewRandomCache =
    new Map<string, TokenFieldPreviewCacheEntry>();

/**
 * Ordered r:/c: values for the whole request body (any format).
 * Body editors pass a JSON / XML / urlencoded / text buffer as the lookup
 * key, which will not match per-field seeds — this sentinel is format-free.
 */
export const TOKEN_FIELD_PREVIEW_BODY_SCOPE = '\0mmt.body';
const BODY_DOCUMENT_CACHE_KEY = TOKEN_FIELD_PREVIEW_BODY_SCOPE;

/** Drop frozen field-preview samples (telescope on / open / before re-seed). */
export function clearTokenFieldPreviewRandomCache(): void {
  tokenFieldPreviewRandomCache.clear();
}

function cacheKeyForFieldSource(source: string): string {
  const raw = String(source ?? '');
  if (isLiteralTokenValue(raw)) {
    return `"${unwrapLiteralToken(raw)}"`;
  }
  return peerStringToDisplay(raw);
}

/**
 * Cache key for a token field. `scope` disambiguates identical templates
 * (`{{r:uuid}}` on a header vs a query param vs a cookie).
 * Pass {@link BODY_DOCUMENT_CACHE_KEY} to read the format-free body list.
 */
function tokenPreviewCacheKey(source: string, scope?: string): string {
  if (scope === BODY_DOCUMENT_CACHE_KEY) {
    return BODY_DOCUMENT_CACHE_KEY;
  }
  const field = cacheKeyForFieldSource(source);
  return scope ? `${scope}\0${field}` : field;
}

/** Scope for a headers/query/cookies row so identical `{{r:uuid}}` values do not collide. */
export function tokenFieldPreviewScope(namespace: string, key: string): string {
  return `${namespace}\0${key}`;
}

export type TokenPreviewCacheScope =
    string|((source: string, tokenStart: number) => string);

function resolvePreviewCacheKey(
    source: string,
    tokenStart: number,
    scope?: TokenPreviewCacheScope,
    ): string {
  if (typeof scope === 'function') {
    return scope(source, tokenStart);
  }
  return tokenPreviewCacheKey(source, scope);
}

/**
 * Cache key for a token inside the URL bar (`path?k=v`). Path tokens use the
 * seeded URL template; query values use the same `query\0name` scope as Params.
 */
export function urlBarTokenPreviewCacheKey(
    urlWithQuery: string,
    tokenStart: number,
    ): string {
  const text = String(urlWithQuery ?? '');
  const q = text.indexOf('?');
  const base = q < 0 ? text : text.slice(0, q);
  if (q < 0 || tokenStart <= q) {
    return tokenPreviewCacheKey(base);
  }
  let i = q + 1;
  while (i <= text.length) {
    const amp = text.indexOf('&', i);
    const pairEnd = amp < 0 ? text.length : amp;
    const eq = text.indexOf('=', i);
    const hasEq = eq >= 0 && eq < pairEnd;
    const key = hasEq ? text.slice(i, eq) : text.slice(i, pairEnd);
    const value = hasEq ? text.slice(eq + 1, pairEnd) : '';
    const valueStart = hasEq ? eq + 1 : pairEnd;
    if (tokenStart >= valueStart && tokenStart < pairEnd && key) {
      return tokenPreviewCacheKey(value, tokenFieldPreviewScope('query', key));
    }
    if (amp < 0) {
      break;
    }
    i = amp + 1;
  }
  return tokenPreviewCacheKey(base);
}

function lookupCachedRandomForFieldPreview(
    sourceKey: string,
    plain: string,
    occurrenceIndex: number,
    ): unknown {
  let entry = tokenFieldPreviewRandomCache.get(sourceKey);
  if (entry && occurrenceIndex < entry.r.length) {
    return entry.r[occurrenceIndex];
  }
  if (!entry) {
    entry = {r: []};
    tokenFieldPreviewRandomCache.set(sourceKey, entry);
  }
  const resolved = lookupRuntimeResolvedValue(plain);
  entry.r.push(resolved);
  return resolved;
}

function lookupCachedCurrentForFieldPreview(
    sourceKey: string,
    plain: string,
    occurrenceIndex: number,
    ): unknown {
  const entry = tokenFieldPreviewRandomCache.get(sourceKey);
  if (entry?.c && occurrenceIndex < entry.c.length) {
    return entry.c[occurrenceIndex];
  }
  return lookupRuntimeResolvedValue(plain);
}

/**
 * Seed frozen `r:` / `c:` preview values from a field's YAML (or display)
 * source and the matching resolved value (wire or `resolveApiRequest`).
 * Cache key matches {@link projectTokenFieldPreview} / TokenFieldInput.
 */
export function seedTokenFieldPreviewFromResolved(
    source: unknown,
    resolved: unknown,
    scope?: string,
    ): void {
  if (source == null || typeof source === 'object') {
    return;
  }
  const sourceText = String(source);
  if (!sourceText || isLiteralTokenValue(sourceText)) {
    return;
  }
  const cacheKey = tokenPreviewCacheKey(sourceText, scope);
  const leaves: TokenResolvedLeaf[] = [];
  walkTokenResolvedLeaves(sourceText, resolved, leaves);
  const rList: unknown[] = [];
  const cList: unknown[] = [];
  let sawCurrent = false;
  for (const leaf of leaves) {
    const prefix = leaf.plain.charAt(0).toLowerCase();
    if (prefix === 'r') {
      rList.push(leaf.piece);
    } else if (prefix === 'c') {
      sawCurrent = true;
      cList.push(leaf.piece);
    }
  }
  if (rList.length === 0 && !sawCurrent) {
    return;
  }
  tokenFieldPreviewRandomCache.set(cacheKey, {
    r: rList,
    ...(sawCurrent ? {c: cList} : {}),
  });
}

function seedTokenFieldPreviewRecord(
    source?: Record<string, unknown>|null,
    resolved?: Record<string, unknown>|null,
    namespace?: string,
    ): void {
  if (!source || typeof source !== 'object') {
    return;
  }
  const res = resolved && typeof resolved === 'object' ? resolved : {};
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(res, key)) {
      continue;
    }
    const scope = namespace ? `${namespace}\0${key}` : undefined;
    seedTokenFieldPreviewFromResolved(source[key], res[key], scope);
  }
}

/**
 * Seed every string leaf in a structured body (or a plain string body) from
 * the matching resolved value (telescope snapshot / resolveApiRequest).
 */
function seedTokenFieldPreviewDeep(
    source: unknown,
    resolved: unknown,
    ): void {
  if (source == null) {
    return;
  }
  if (typeof source === 'string') {
    seedTokenFieldPreviewFromResolved(source, resolved);
    return;
  }
  if (Array.isArray(source)) {
    const resolvedArr = Array.isArray(resolved) ? resolved : [];
    for (let i = 0; i < source.length; i++) {
      seedTokenFieldPreviewDeep(source[i], resolvedArr[i]);
    }
    return;
  }
  if (typeof source === 'object') {
    const srcObj = source as Record<string, unknown>;
    const resObj =
        resolved && typeof resolved === 'object' && !Array.isArray(resolved) ?
          resolved as Record<string, unknown> :
          {};
    for (const key of Object.keys(srcObj)) {
      if (!Object.prototype.hasOwnProperty.call(resObj, key)) {
        continue;
      }
      seedTokenFieldPreviewDeep(srcObj[key], resObj[key]);
    }
  }
}

/**
 * Seed ordered body r:/c: values from YAML source + resolved snapshot.
 * Independent of JSON / XML / urlencoded / text serialization — hover looks
 * tokens up by occurrence in the editor buffer, then reads this list.
 */
function seedTokenFieldPreviewBodyDocument(
    sourceBody: unknown,
    resolvedBody: unknown,
    ): void {
  if (sourceBody == null || resolvedBody == null) {
    return;
  }
  const leaves: TokenResolvedLeaf[] = [];
  walkTokenResolvedLeaves(sourceBody, resolvedBody, leaves);
  const rList: unknown[] = [];
  const cList: unknown[] = [];
  let sawCurrent = false;
  for (const leaf of leaves) {
    const prefix = leaf.plain.charAt(0).toLowerCase();
    if (prefix === 'r') {
      rList.push(leaf.piece);
    } else if (prefix === 'c') {
      sawCurrent = true;
      cList.push(leaf.piece);
    }
  }
  if (rList.length === 0 && !sawCurrent) {
    return;
  }
  tokenFieldPreviewRandomCache.set(BODY_DOCUMENT_CACHE_KEY, {
    r: rList,
    ...(sawCurrent ? {c: cList} : {}),
  });
}

/**
 * Clear and re-seed field-preview caches from an API YAML model + resolved
 * request so telescope fields / tokens-mode tips match wire values (Send,
 * open, telescope-on).
 */
export function seedTokenFieldPreviewFromRequest(
    source: {
      url?: unknown;
      headers?: Record<string, unknown>|null;
      query?: Record<string, unknown>|null;
      cookies?: Record<string, unknown>|null;
      body?: unknown;
      graphql?: {operation?: unknown}|null;
    }|null|undefined,
    resolved: {
      url?: unknown;
      headers?: Record<string, unknown>|null;
      query?: Record<string, unknown>|null;
      cookies?: Record<string, unknown>|null;
      body?: unknown;
      graphql?: {operation?: unknown}|null;
    }|null|undefined,
    ): void {
  clearTokenFieldPreviewRandomCache();
  if (!source || !resolved) {
    return;
  }
  if (source.url != null) {
    seedTokenFieldPreviewFromResolved(source.url, resolved.url);
  }
  seedTokenFieldPreviewRecord(source.headers, resolved.headers, 'headers');
  seedTokenFieldPreviewRecord(source.query, resolved.query, 'query');
  seedTokenFieldPreviewRecord(source.cookies, resolved.cookies, 'cookies');
  if (source.body != null) {
    seedTokenFieldPreviewDeep(source.body, resolved.body);
    seedTokenFieldPreviewBodyDocument(source.body, resolved.body);
  }
  if (source.graphql?.operation != null) {
    seedTokenFieldPreviewFromResolved(
        source.graphql.operation, resolved.graphql?.operation);
  }
}

/**
 * True when a request leaf is / resolves to the omit sentinel (Send drops it).
 * Literal `"omit"` strings are not omit.
 */
export function leafResolvesToOmit(
    value: unknown,
    ctx?: RuntimeTokenValueContext,
): boolean {
  if (isOmitSentinel(value)) {
    return true;
  }
  if (typeof value !== 'string' || !value) {
    return false;
  }
  if (!ctx) {
    return false;
  }
  if (!stringContainsFieldToken(value) && !stringContainsRuntimeToken(value)) {
    return false;
  }
  try {
    const out = replaceAllRefs(
        {v: value},
        {},
        (ctx.inputs || {}) as Record<string, any>,
        (ctx.env || {}) as Record<string, any>,
        new Set(),
    );
    const resolved = out?.v;
    if (isOmitSentinel(resolved)) {
      return true;
    }
    if (typeof resolved === 'string' && resolved.includes(OMIT_SENTINEL)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Idle preview for a token-capable field (telescope / resolved mode):
 * - `{{i:}}` / `{{e:}}` → resolved values (span kind `resolved`)
 * - `{{c:}}` → live current values, or seeded wire/resolve snapshot when
 *   {@link seedTokenFieldPreviewFromResolved} ran
 * - `{{r:}}` → frozen samples (stable until
 *   {@link clearTokenFieldPreviewRandomCache} — telescope on / open)
 * - Unresolved i:/e: stay as the plain token text `i:name` / `e:name`
 */
export function projectTokenFieldPreview(
    source: string,
    ctx?: RuntimeTokenValueContext,
    scope?: TokenPreviewCacheScope,
    ): {text: string; spans: TokenFieldSpan[]} {
  const raw = String(source ?? '');
  if (isLiteralTokenValue(raw)) {
    const inner = `"${unwrapLiteralToken(raw)}"`;
    return {text: inner, spans: []};
  }
  const template = rewriteAllTokensToDisplayText(raw);
  let text = '';
  const spans: TokenFieldSpan[] = [];
  const re = new RegExp(DISPLAY_PREFIXED_GLOBAL_RE.source, 'gi');
  let last = 0;
  let match: RegExpExecArray|null;
  const randomOccurrence = new Map<string, number>();
  const currentOccurrence = new Map<string, number>();
  while ((match = re.exec(template)) !== null) {
    if (match.index > last) {
      text += template.slice(last, match.index);
    }
    const plain = displayTokenToPlain(match[0]);
    if (!plain) {
      text += match[0];
      last = match.index + match[0].length;
      continue;
    }
    const cacheKey = resolvePreviewCacheKey(template, match.index, scope);
    const prefix = plain.charAt(0).toLowerCase();
    let resolved: unknown = undefined;
    if (prefix === 'r') {
      const occ = randomOccurrence.get(cacheKey) ?? 0;
      randomOccurrence.set(cacheKey, occ + 1);
      resolved = lookupCachedRandomForFieldPreview(cacheKey, plain, occ);
    } else if (prefix === 'c') {
      const occ = currentOccurrence.get(cacheKey) ?? 0;
      currentOccurrence.set(cacheKey, occ + 1);
      resolved = lookupCachedCurrentForFieldPreview(cacheKey, plain, occ);
    } else {
      resolved = lookupIeResolvedValue(plain, ctx);
    }
    if (resolved === undefined) {
      // Same fallback as a run: the plain token text, not {{…}} and not blank.
      const piece = (prefix === 'c' || prefix === 'r') ?
        toDisplayRuntimeToken(plain) :
        plain;
      const start = text.length;
      text += piece;
      spans.push({start, end: text.length, kind: 'token'});
    } else {
      const piece = ieResolvedToDisplayText(resolved);
      const start = text.length;
      text += piece;
      if (piece.length > 0) {
        spans.push({
          start,
          end: text.length,
          kind: 'resolved',
          tooltip: toDisplayRuntimeToken(plain),
        });
      }
    }
    last = match.index + match[0].length;
  }
  text += template.slice(last);
  return {text, spans};
}

type DisplayTokenMatch = {start: number; end: number; plain: string};

/**
 * Every `{{i|e|r|c:…}}` (and legacy) in `text`, left to right.
 * Format-agnostic: JSON, XML, urlencoded, and plain text all go through here.
 */
function collectDisplayTokenMatches(text: string): DisplayTokenMatch[] {
  if (!text) {
    return [];
  }
  const matches: DisplayTokenMatch[] = [];
  const patterns = [DISPLAY_PREFIXED_GLOBAL_RE, LEGACY_DISPLAY_RUNTIME_GLOBAL_RE];
  for (const base of patterns) {
    const re = new RegExp(base.source, 'gi');
    let match: RegExpExecArray|null;
    while ((match = re.exec(text)) !== null) {
      const plain = displayTokenToPlain(match[0]);
      if (!plain) {
        continue;
      }
      const start = match.index;
      const end = match.index + match[0].length;
      if (matches.some(m => !(end <= m.start || start >= m.end))) {
        continue;
      }
      matches.push({start, end, plain});
    }
  }
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Char-offset ranges for `{{i|e|r|c:…}}` (and legacy) in edit-buffer text.
 * Tooltips for `r:`/`c:` use the field-preview cache, then the body-document
 * list from Send — format does not matter.
 */
export function findDisplayTokenCharRanges(
    text: string,
    ctx?: RuntimeTokenValueContext,
    scope?: TokenPreviewCacheScope,
    ): TokenFieldSpan[] {
  const matches = collectDisplayTokenMatches(text);
  const spans: TokenFieldSpan[] = [];
  const randomOccurrence = new Map<string, number>();
  const currentOccurrence = new Map<string, number>();
  for (const m of matches) {
    const cacheKey = resolvePreviewCacheKey(text, m.start, scope);
    const prefix = m.plain.charAt(0).toLowerCase();
    let resolved: unknown = undefined;
    if (prefix === 'r') {
      const occ = randomOccurrence.get(cacheKey) ?? 0;
      randomOccurrence.set(cacheKey, occ + 1);
      resolved = lookupCachedRandomForFieldPreview(cacheKey, m.plain, occ);
    } else if (prefix === 'c') {
      const occ = currentOccurrence.get(cacheKey) ?? 0;
      currentOccurrence.set(cacheKey, occ + 1);
      resolved = lookupCachedCurrentForFieldPreview(cacheKey, m.plain, occ);
    } else {
      resolved = lookupIeResolvedValue(m.plain, ctx);
    }
    const tooltip = resolved === undefined ?
      undefined :
      ieResolvedToDisplayText(resolved);
    spans.push({
      start: m.start,
      end: m.end,
      kind: 'token',
      tooltip: tooltip || undefined,
    });
  }
  return spans;
}

/**
 * Hover/underline spans for body text.
 * - Marks any `{{…}}` still visible (tooltip = resolved value when known).
 * - When `tokenSource` + `resolvedBody` are set, marks substituted i:/e:/r:/c:
 *   leaf values using the real resolved body (stable r:/c: UUIDs).
 * - Else when `tokenTemplate` is set, aligns template → display for i:/e:/r:/c:.
 */
export function findBodyTokenHoverSpans(
    displayText: string,
    options?: {
      tokenTemplate?: string;
      valueContext?: RuntimeTokenValueContext;
      tokenSource?: unknown;
      resolvedBody?: unknown;
    },
    ): TokenFieldSpan[] {
  const ctx = options?.valueContext;
  const fromDisplay = findDisplayTokenCharRanges(
      displayText, ctx, BODY_DOCUMENT_CACHE_KEY);
  const leaves = collectTokenResolvedLeaves(
      options?.tokenSource, options?.resolvedBody);
  const fromLeaves = leaves.length > 0 ?
    locateLeafSpansInDisplay(displayText, leaves) :
    locateTemplateSpansInDisplay(displayText, options?.tokenTemplate);

  const merged = [...fromLeaves];
  for (const span of fromDisplay) {
    const overlaps = merged.some(
        (s) => !(span.end <= s.start || span.start >= s.end));
    if (!overlaps) {
      merged.push(span);
    }
  }
  merged.sort((a, b) => a.start - b.start);
  return merged;
}

type TokenResolvedLeaf = {
  plain: string;
  piece: string;
  /** Object key when known — pins JSON highlights to the matching field. */
  key?: string|number;
  /**
   * Full resolved field string when the token was embedded
   * (`asda<<c:day>>asas` → `asdaWednesdayasas`).
   */
  fieldResolved?: string;
  /** Index of `piece` inside `fieldResolved` (embedded tokens). */
  pieceOffset?: number;
};

type EmbedPart =
    {kind: 'text'; value: string}|
    {kind: 'token'; plain: string};

/** Split a mixed string into literal + token parts (`<<…>>` / `{{…}}`). */
function splitEmbeddedTokenParts(source: string): EmbedPart[]|null {
  const text = String(source ?? '');
  if (!text) {
    return null;
  }
  const parts: EmbedPart[] = [];
  const angleRe = new RegExp(
      `<<\\s*((?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}|` +
          `(?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})\\s*>>`,
      'gi',
  );
  const displayRe = new RegExp(DISPLAY_PREFIXED_GLOBAL_RE.source, 'gi');
  type Hit = {start: number; end: number; plain: string};
  const hits: Hit[] = [];
  let match: RegExpExecArray|null;
  while ((match = angleRe.exec(text)) !== null) {
    const plain = String(match[1] ?? '').trim();
    if (!plain) {
      continue;
    }
    const prefix = plain.charAt(0).toLowerCase();
    if (prefix !== 'i' && prefix !== 'e' && prefix !== 'r' && prefix !== 'c') {
      continue;
    }
    hits.push({start: match.index, end: match.index + match[0].length, plain});
  }
  while ((match = displayRe.exec(text)) !== null) {
    const plain = displayTokenToPlain(match[0]);
    if (!plain) {
      continue;
    }
    const prefix = plain.charAt(0).toLowerCase();
    if (prefix !== 'i' && prefix !== 'e' && prefix !== 'r' && prefix !== 'c') {
      continue;
    }
    hits.push({start: match.index, end: match.index + match[0].length, plain});
  }
  if (hits.length === 0) {
    return null;
  }
  hits.sort((a, b) => a.start - b.start);
  // Drop overlapping hits (prefer earlier / longer).
  const picked: Hit[] = [];
  for (const hit of hits) {
    const last = picked[picked.length - 1];
    if (last && hit.start < last.end) {
      continue;
    }
    picked.push(hit);
  }
  let cursor = 0;
  for (const hit of picked) {
    if (hit.start > cursor) {
      parts.push({kind: 'text', value: text.slice(cursor, hit.start)});
    }
    parts.push({kind: 'token', plain: hit.plain});
    cursor = hit.end;
  }
  if (cursor < text.length) {
    parts.push({kind: 'text', value: text.slice(cursor)});
  }
  return parts.some((p) => p.kind === 'token') ? parts : null;
}

/**
 * Recover each embedded token's resolved slice by aligning literal prefix/suffix
 * against the fully resolved field string.
 */
function collectEmbeddedResolvedLeaves(
    source: string,
    resolvedNode: unknown,
    out: TokenResolvedLeaf[],
    key?: string|number,
    ): boolean {
  const parts = splitEmbeddedTokenParts(source);
  if (!parts) {
    return false;
  }
  // Prefer the raw resolved string so offsets match the JSON display value.
  const resolvedText = typeof resolvedNode === 'string' ?
    resolvedNode :
    ieResolvedToDisplayText(resolvedNode);
  if (resolvedText === '') {
    return false;
  }
  let cursor = 0;
  let found = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === 'text') {
      if (!part.value) {
        continue;
      }
      if (!resolvedText.startsWith(part.value, cursor)) {
        return found;
      }
      cursor += part.value.length;
      continue;
    }
    const nextText = parts.slice(i + 1).find(
        (p): p is {kind: 'text'; value: string} =>
          p.kind === 'text' && Boolean(p.value),
    );
    const restAfterNext = nextText ?
      parts.slice(parts.indexOf(nextText) + 1) :
      [];
    const nextIsTrailingLiteral = Boolean(nextText) &&
        restAfterNext.every((p) => p.kind === 'text');
    let end = resolvedText.length;
    if (nextText) {
      let nextIdx = -1;
      if (nextIsTrailingLiteral &&
          resolvedText.endsWith(nextText.value) &&
          resolvedText.length - nextText.value.length >= cursor) {
        // Pin trailing literals from the end so a suffix like `asas` is not
        // found inside `…Amsterdamasas` at an earlier overlapping offset.
        nextIdx = resolvedText.length - nextText.value.length;
      } else {
        nextIdx = resolvedText.indexOf(nextText.value, cursor);
      }
      if (nextIdx < 0) {
        return found;
      }
      end = nextIdx;
    }
    const piece = resolvedText.slice(cursor, end);
    if (piece.length > 0) {
      out.push({
        plain: part.plain,
        piece,
        key,
        fieldResolved: resolvedText,
        pieceOffset: cursor,
      });
      found = true;
    }
    cursor = end;
  }
  return found;
}

function collectTokenResolvedLeaves(
    tokenSource: unknown,
    resolvedBody: unknown,
    ): TokenResolvedLeaf[] {
  if (tokenSource === undefined || resolvedBody === undefined) {
    return [];
  }
  const out: TokenResolvedLeaf[] = [];
  walkTokenResolvedLeaves(tokenSource, resolvedBody, out);
  return out;
}

function walkTokenResolvedLeaves(
    tokenNode: unknown,
    resolvedNode: unknown,
    out: TokenResolvedLeaf[],
    key?: string|number,
    ): void {
  if (typeof tokenNode === 'string') {
    if (isLiteralTokenValue(tokenNode)) {
      return;
    }
    const plain = plainTokenFromLeaf(tokenNode) ||
        displayTokenToPlain(tokenNode.trim()) ||
        angleToPlain(tokenNode.trim());
    if (plain) {
      const prefix = plain.charAt(0).toLowerCase();
      if (prefix !== 'i' && prefix !== 'e' && prefix !== 'r' && prefix !== 'c') {
        return;
      }
      const piece = ieResolvedToDisplayText(resolvedNode);
      if (!piece) {
        return;
      }
      out.push({plain, piece, key});
      return;
    }
    // Mixed literals + <<…>> / {{…}} (e.g. asda<<c:day>>asas).
    collectEmbeddedResolvedLeaves(tokenNode, resolvedNode, out, key);
    return;
  }
  if (Array.isArray(tokenNode)) {
    const resolvedArr = Array.isArray(resolvedNode) ? resolvedNode : [];
    for (let i = 0; i < tokenNode.length; i++) {
      walkTokenResolvedLeaves(tokenNode[i], resolvedArr[i], out, i);
    }
    return;
  }
  if (tokenNode && typeof tokenNode === 'object') {
    const tokenObj = tokenNode as Record<string, unknown>;
    const resolvedObj =
        resolvedNode && typeof resolvedNode === 'object' &&
                !Array.isArray(resolvedNode) ?
        resolvedNode as Record<string, unknown> :
        {};
    for (const objKey of Object.keys(tokenObj)) {
      walkTokenResolvedLeaves(tokenObj[objKey], resolvedObj[objKey], out, objKey);
    }
  }
}

function escapeRegExpLocal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locate a resolved value under a specific JSON object key so short pieces
 * (e.g. `Ams`) are not painted inside longer siblings (`Amsterdam`).
 * When `fieldResolved` is set (embedded token), match the whole field value
 * and underline `piece` at `pieceOffset` inside it.
 */
function indexOfKeyedJsonPiece(
    displayText: string,
    key: string,
    piece: string,
    fieldResolved?: string,
    pieceOffset?: number,
    ): {start: number; end: number}|null {
  if (!piece || !key) {
    return null;
  }
  const haystack = fieldResolved && fieldResolved.length > 0 ? fieldResolved : piece;
  const quoted = JSON.stringify(haystack);
  const keyedQuoted = new RegExp(
      `"${escapeRegExpLocal(key)}"\\s*:\\s*(${escapeRegExpLocal(quoted)})`,
  );
  const quotedMatch = keyedQuoted.exec(displayText);
  if (quotedMatch && quotedMatch.index != null) {
    const valueStart =
        quotedMatch.index + quotedMatch[0].length - quotedMatch[1].length;
    // Underline the string contents (not the surrounding JSON quotes).
    if (quoted.startsWith('"') && quoted.endsWith('"') && quoted.length >= 2) {
      const contentStart = valueStart + 1;
      if (fieldResolved && typeof pieceOffset === 'number' && pieceOffset >= 0) {
        return {
          start: contentStart + pieceOffset,
          end: contentStart + pieceOffset + piece.length,
        };
      }
      return {start: contentStart, end: contentStart + piece.length};
    }
    return {start: valueStart, end: valueStart + quotedMatch[1].length};
  }
  if (fieldResolved) {
    return null;
  }
  const keyedBare = new RegExp(
      `"${escapeRegExpLocal(key)}"\\s*:\\s*(${escapeRegExpLocal(piece)})(?=\\s*[,}\\]])`,
  );
  const bareMatch = keyedBare.exec(displayText);
  if (bareMatch && bareMatch.index != null) {
    const valueStart =
        bareMatch.index + bareMatch[0].length - bareMatch[1].length;
    return {start: valueStart, end: valueStart + bareMatch[1].length};
  }
  return null;
}

function sameTokenPlain(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Tokens-mode body still shows `{{r:uuid}}` / `<<r:uuid>>` — find those
 * forms in the editor buffer (JSON, XML, urlencoded, text) and tip the
 * matching resolved leaf. Order follows unused matches of the same plain.
 */
function takeDisplayTokenMatch(
    matches: DisplayTokenMatch[],
    used: Set<number>,
    plain: string,
    ): DisplayTokenMatch|null {
  const idx = matches.findIndex(
      (m, i) => !used.has(i) && sameTokenPlain(m.plain, plain));
  if (idx < 0) {
    return null;
  }
  used.add(idx);
  return matches[idx];
}

function locateLeafSpansInDisplay(
    displayText: string,
    leaves: TokenResolvedLeaf[],
    ): TokenFieldSpan[] {
  const spans: TokenFieldSpan[] = [];
  const used = new Set<string>();
  const tokenMatches = collectDisplayTokenMatches(displayText);
  const usedTokenMatches = new Set<number>();
  let searchFrom = 0;
  for (const leaf of leaves) {
    let located: {start: number; end: number}|null = null;
    let tokensMode = false;
    const tokenHit = takeDisplayTokenMatch(
        tokenMatches, usedTokenMatches, leaf.plain);
    if (tokenHit) {
      located = {start: tokenHit.start, end: tokenHit.end};
      tokensMode = true;
    }
    if (!located && typeof leaf.key === 'string' && leaf.key.length > 0) {
      located = indexOfKeyedJsonPiece(
          displayText,
          leaf.key,
          leaf.piece,
          leaf.fieldResolved,
          leaf.pieceOffset,
      );
    }
    if (!located && leaf.fieldResolved && typeof leaf.pieceOffset === 'number') {
      // Unkeyed / non-JSON: find the full resolved field, then offset into it.
      const fieldIdx = displayText.indexOf(leaf.fieldResolved, searchFrom);
      if (fieldIdx >= 0) {
        located = {
          start: fieldIdx + leaf.pieceOffset,
          end: fieldIdx + leaf.pieceOffset + leaf.piece.length,
        };
      }
    }
    if (!located) {
      located = indexOfResolvedPiece(displayText, leaf.piece, searchFrom);
    }
    if (!located) {
      continue;
    }
    const spanKey = `${located.start}:${located.end}`;
    if (used.has(spanKey)) {
      continue;
    }
    used.add(spanKey);
    spans.push({
      start: located.start,
      end: located.end,
      kind: tokensMode ? 'token' : 'resolved',
      tooltip: tokensMode ?
        leaf.piece :
        toDisplayRuntimeToken(leaf.plain),
    });
    // Only advance the sequential cursor for unkeyed fallbacks so keyed hits
    // do not skip later fields that appear earlier in the document.
    if (typeof leaf.key !== 'string' || leaf.key.length === 0) {
      searchFrom = located.end;
    }
  }
  return spans;
}

function locateTemplateSpansInDisplay(
    displayText: string,
    tokenTemplate: string|undefined,
    ): TokenFieldSpan[] {
  if (!tokenTemplate) {
    return [];
  }
  const parts: Array<{kind: 'text'|'token'; value: string; plain?: string}> = [];
  const re = new RegExp(DISPLAY_PREFIXED_GLOBAL_RE.source, 'gi');
  let last = 0;
  let match: RegExpExecArray|null;
  while ((match = re.exec(tokenTemplate)) !== null) {
    if (match.index > last) {
      parts.push({kind: 'text', value: tokenTemplate.slice(last, match.index)});
    }
    const plain = displayTokenToPlain(match[0]);
    if (plain) {
      parts.push({kind: 'token', value: match[0], plain});
    } else {
      parts.push({kind: 'text', value: match[0]});
    }
    last = match.index + match[0].length;
  }
  if (last < tokenTemplate.length) {
    parts.push({kind: 'text', value: tokenTemplate.slice(last)});
  }

  const spans: TokenFieldSpan[] = [];
  let searchFrom = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.kind === 'text') {
      if (!part.value) {
        continue;
      }
      const idx = displayText.indexOf(part.value, searchFrom);
      if (idx < 0) {
        return spans;
      }
      searchFrom = idx + part.value.length;
      continue;
    }
    let valueEnd = displayText.length;
    const nextText = parts.slice(i + 1).find((p) => p.kind === 'text' && p.value);
    if (nextText) {
      const nextIdx = displayText.indexOf(nextText.value, searchFrom);
      if (nextIdx < 0) {
        return spans;
      }
      valueEnd = nextIdx;
    }
    if (valueEnd > searchFrom && part.plain) {
      spans.push({
        start: searchFrom,
        end: valueEnd,
        kind: 'resolved',
        tooltip: toDisplayRuntimeToken(part.plain),
      });
    }
    searchFrom = valueEnd;
  }
  return spans;
}

function indexOfResolvedPiece(
    displayText: string,
    piece: string,
    searchFrom: number,
    ): {start: number; end: number}|null {
  if (!piece) {
    return null;
  }
  // Prefer JSON-quoted form first so a short value like `Ams` is not found as
  // a prefix inside a longer sibling value like `Amsterdam`.
  const quoted = JSON.stringify(piece);
  let idx = displayText.indexOf(quoted, searchFrom);
  if (idx >= 0) {
    return {start: idx + 1, end: idx + 1 + piece.length};
  }
  idx = displayText.indexOf(piece, searchFrom);
  if (idx >= 0) {
    return {start: idx, end: idx + piece.length};
  }
  return null;
}

/** Monaco ranges for body token underlines + hover tooltips. */
export function findBodyTokenHoverRanges(
    displayText: string,
    options?: {
      tokenTemplate?: string;
      valueContext?: RuntimeTokenValueContext;
      tokenSource?: unknown;
      resolvedBody?: unknown;
    },
    ): BodyTokenHoverRange[] {
  return findBodyTokenHoverSpans(displayText, options).map((span) => {
    const start = indexToPosition(displayText, span.start);
    const end = indexToPosition(displayText, span.end);
    return {
      startLineNumber: start.line,
      startColumn: start.column,
      endLineNumber: end.line,
      endColumn: end.column,
      kind: span.kind,
      tooltip: span.tooltip,
    };
  });
}

/**
 * Pack a tester edit-buffer value back to YAML token forms
 * (`{{i:x}}` → `<<i:x>>` / bare, etc.).
 */
export function valueForYamlSave(uiValue: unknown): unknown {
  return reviveDisplayRuntimeTokensInValue(uiValue);
}

/**
 * Project a resolved string map for the tester UI, keeping r:/c: from `source`
 * as `{{…}}` (headers, query, cookies, GraphQL variables, …).
 */
export function displayRuntimeStringRecord(
    resolved?: Record<string, unknown>|null,
    source?: Record<string, unknown>|null,
): Record<string, string> {
  const res = resolved && typeof resolved === 'object' ? resolved : {};
  const src = source && typeof source === 'object' ? source : {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(res)) {
    const srcVal = Object.prototype.hasOwnProperty.call(src, key) ?
      src[key] :
      undefined;
    out[key] = displayRuntimeString(val, srcVal);
  }
  return out;
}

/** Walk a value tree and convert `{{…}}` display tokens to `<<r:/c:…>>`. */
export function displayTokensToResolvableDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return displayRuntimeTokensToResolvableText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => displayTokensToResolvableDeep(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          displayTokensToResolvableDeep(v),
        ]),
    );
  }
  return value;
}

/**
 * YAML → tester peer display for a single string field.
 * `r:uuid` / `<<i:x>>` → `{{r:uuid}}` / `{{i:x}}`.
 */
export function peerStringToDisplay(yaml: unknown): string {
  if (yaml == null) {
    return '';
  }
  if (typeof yaml === 'string') {
    return sourceToDisplayTokenTemplate(yaml);
  }
  return sourceToDisplayTokenTemplate(String(yaml));
}

/**
 * YAML string map → tester peer display map (`{{…}}` tokens).
 */
export function peerRecordToDisplay(
    yaml?: Record<string, unknown>|null,
): Record<string, string> {
  const src = yaml && typeof yaml === 'object' ? yaml : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(src)) {
    out[key] = peerStringToDisplay(value);
  }
  return out;
}

/**
 * Tester peer string → YAML form.
 * Accepts bare `r:uuid`, `{{r:uuid}}`, or `<<r:uuid>>` → stores `r:uuid`
 * (or `<<…>>` when embedded in larger text).
 *
 * Incomplete / unknown whole `{{r:…}}` values strip to bare `r:…` so YAML does
 * not quote braces mid-keystroke (which would later stick as literal style).
 */
export function peerStringToYaml(ui: string): string {
  const normalized = rewriteAllTokensToDisplayText(String(ui ?? ''));
  const packed = valueForYamlSave(normalized);
  if (typeof packed !== 'string') {
    return String(packed ?? '');
  }
  const trimmed = packed.trim();
  const display = WHOLE_DISPLAY_PREFIXED_RE.exec(trimmed);
  if (display && packed === trimmed) {
    // Known tokens already revived above; this catches incomplete `{{r:u}}`.
    return `${display[1]}:${display[2].trim()}`;
  }
  return packed;
}

/**
 * Tester peer string map → YAML map. Empty maps become `undefined` so the
 * key is omitted from the file.
 */
export function peerRecordToYaml(
    ui?: Record<string, string>|null,
): Record<string, string>|undefined {
  if (!ui || typeof ui !== 'object') {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(ui)) {
    if (!key.trim() && !(value ?? '').trim()) {
      continue;
    }
    out[key] = peerStringToYaml(value ?? '');
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
