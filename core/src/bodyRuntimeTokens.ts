import {
  CURRENT_FUTURE_PAST_ALIASES,
  CURRENT_TOKEN_MAP,
} from './Current';
import {
  isLiteralTokenValue,
  unwrapLiteralToken,
} from './literalToken';
import {RANDOM_TOKEN_MAP} from './Random';
import {
  ACCESSOR_PATH_RE,
  TOKEN_NAME_RE,
  applyValueAccessor,
} from './variableReplacer';
import {
  stringContainsRuntimeToken,
  type TextPositionRange,
} from './runtimeTokenUi';

/** Loose `(...)` so display/parse accept any args on known r:/c: keywords. */
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
    /\{\{\s*([ierce]):((?:[^{}]|\([^)]*\))+?)\s*\}\}/gi;
const WHOLE_DISPLAY_PREFIXED_RE =
    /^\{\{\s*([ierce]):((?:[^{}]|\([^)]*\))+?)\s*\}\}$/i;
/** Match a display token at the start of a string (for JSON unquoted scan). */
const DISPLAY_PREFIXED_AT_RE =
    /^\{\{\s*([ierce]):((?:[^{}]|\([^)]*\))+?)\s*\}\}/i;

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

/**
 * r:/c: tokens whose resolved value is a JSON number or boolean — shown
 * unquoted as `{{r:int}}`. Everything else is a string and shown as
 * `"{{r:uuid}}"` so resolve is plain text substitution inside the quotes.
 */
const NON_STRING_RANDOM_TOKENS = new Set([
  'int',
  'float',
  'bool',
  'latitude',
  'longitude',
  'epoch',
  'epoch_ms',
  'epoch_now',
  'epoch_now_ms',
  'epoch_future',
  'epoch_future_ms',
  'epoch_past',
  'epoch_past_ms',
]);

const NON_STRING_CURRENT_TOKENS = new Set([
  'epoch',
  'epoch_ms',
  'weekday_number',
  'day',
  'month',
  'year',
]);

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
 * - `r:` / `c:` — from known token kinds (unchanged).
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
    if (!Object.prototype.hasOwnProperty.call(RANDOM_TOKEN_MAP, name)) {
      return true;
    }
    return !NON_STRING_RANDOM_TOKENS.has(name);
  }
  const alias = CURRENT_FUTURE_PAST_ALIASES[name];
  if (alias) {
    name = alias.base;
  }
  if (!Object.prototype.hasOwnProperty.call(CURRENT_TOKEN_MAP, name) &&
      !NON_STRING_CURRENT_TOKENS.has(name)) {
    return true;
  }
  return !NON_STRING_CURRENT_TOKENS.has(name);
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
    if (!rest || !'ierce'.includes(prefix)) {
      return null;
    }
    const plain = `${prefix}:${rest}`;
    if (prefix === 'r' || prefix === 'c') {
      return stringContainsRuntimeToken(plain) ? plain : null;
    }
    // i: / e: — accept any TOKEN_NAME-shaped rest (including accessors).
    return new RegExp(`^(?:i|e):(?:${TOKEN_NAME_RE})${ACCESSOR_PATH_RE}$`)
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
    if (isWholeBareRuntimeToken(value) || isWholeLiteralRuntimeToken(value) ||
        displayTokenToPlain(value) || angleToPlain(value.trim())) {
      return toDisplayRuntimeToken(value);
    }
    if (isLiteralTokenValue(value)) {
      return rewriteRuntimeTokensInText(unwrapLiteralToken(value));
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
      return rewriteAllTokensToDisplayText(unwrapLiteralToken(value));
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
 * Parse XML (or XML-like editor text) and revive `{{random …}}` leaves to
 * bare `r:`/`c:` markers. `{{}}` is valid in XML text, so no placeholders.
 */
export function parseXmlTextWithRuntimeTokens(
    text: string,
    parseXml: (xml: string) => unknown,
): unknown {
  const parsed = parseXml(text);
  return reviveDisplayRuntimeTokensInValue(parsed);
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
  return String(text ?? '').replace(
      /%7B%7B(?:(?:random|current)(?:[A-Za-z0-9_\-().+\s]|%[0-9A-Fa-f]{2})*|[ierce](?::|%3A)(?:[A-Za-z0-9_\-().+,]|%[0-9A-Fa-f]{2})*)%7D%7D/gi,
      (match) => {
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

/**
 * Prefer typeof of the resolved leaf (what Send uses) for i:/e: quoting;
 * fall back to inputs/env context; default string.
 */
function tokenEmitsJsonStringForLeaf(
    plain: string,
    resolvedLeaf: unknown,
    ctx?: RuntimeTokenValueContext,
    forceBarePlains?: ReadonlySet<string>,
): boolean {
  if (/^[ie]:/i.test(plain) && resolvedLeaf !== undefined) {
    if (resolvedLeaf === null ||
        typeof resolvedLeaf === 'number' ||
        typeof resolvedLeaf === 'boolean') {
      return false;
    }
    return true;
  }
  if (/^[ie]:/i.test(plain) && ctx) {
    const val = lookupIeResolvedValue(plain, ctx);
    if (val !== undefined) {
      if (val === null || typeof val === 'number' || typeof val === 'boolean') {
        return false;
      }
      return true;
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

function writeJsonWithRuntimeTokens(
    value: unknown,
    space: number,
    level: number,
    ctx?: RuntimeTokenValueContext,
    resolvedHint?: unknown,
    forceBarePlains?: ReadonlySet<string>,
): string {
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
    const plain = plainTokenFromLeaf(value);
    if (plain && (stringContainsRuntimeToken(plain) || /^[ie]:/i.test(plain))) {
      return jsonFormForRuntimePlain(plain, ctx, resolvedHint, forceBarePlains);
    }
    if (isWholeLiteralRuntimeToken(value)) {
      return JSON.stringify(toDisplayRuntimeToken(value));
    }
    if (isLiteralTokenValue(value)) {
      return JSON.stringify(rewriteRuntimeTokensInText(unwrapLiteralToken(value)));
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
                forceBarePlains))
            .join(',')
      }]`;
    }
    const innerIndent = ' '.repeat(space * (level + 1));
    const outerIndent = ' '.repeat(space * level);
    const parts = value.map(
        (item, i) => `${innerIndent}${
          writeJsonWithRuntimeTokens(
              item, space, level + 1, ctx, hintArr ? hintArr[i] : undefined,
              forceBarePlains)}`,
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
                    forceBarePlains)}`)
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
                forceBarePlains)}`,
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
): string {
  return writeJsonWithRuntimeTokens(
      value, pretty ? 2 : 0, 0, ctx, resolvedHint, forceBarePlains);
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
  const replaced = mapUnquotedDisplayRuntimeTokens(text, (plain) => {
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
    return resolved;
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
  try {
    return rewriteAllTokensToDisplayText(JSON.stringify(source));
  } catch {
    return rewriteAllTokensToDisplayText(String(source));
  }
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
