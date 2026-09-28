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

/** Body-editor display form: `{{random uuid}}` / `{{current date(+1d)}}`. */
const DISPLAY_RUNTIME_AT_RE =
    /^\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}/i;
const DISPLAY_RUNTIME_GLOBAL_RE =
    /\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}/gi;
const WHOLE_DISPLAY_RUNTIME_RE =
    /^\{\{\s*(random|current)\s+((?:[^{}]|\([^)]*\))+?)\s*\}\}$/i;

const PLACEHOLDER_PREFIX = '__MMT_RT_';
const PLACEHOLDER_RE = new RegExp(`^${PLACEHOLDER_PREFIX}(\\d+)__$`);

/**
 * r:/c: tokens whose resolved value is a JSON number or boolean — shown
 * unquoted as `{{random int}}`. Everything else is a string and shown as
 * `"{{random uuid}}"` so resolve is plain text substitution inside the quotes.
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
 * True when this r:/c: token resolves to a JSON string (needs quotes in the
 * body so substitution keeps a string). False for number/bool tokens.
 */
export function runtimeTokenEmitsJsonString(plainSpec: string): boolean {
  const parsed = tokenKeyword(plainSpec);
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
  const m = WHOLE_ANGLE_RUNTIME_RE.exec(angled.trim());
  return m ? m[1] : null;
}

/**
 * `{{random uuid}}` / `{{current epoch ms}}` → `r:uuid` / `c:epoch_ms`.
 * Spaces in the name become underscores; args like `(10,20)` stay as-is.
 */
export function displayTokenToPlain(display: string): string|null {
  const m = WHOLE_DISPLAY_RUNTIME_RE.exec(String(display ?? '').trim());
  if (!m) {
    return null;
  }
  const prefix = m[1].toLowerCase() === 'random' ? 'r' : 'c';
  const rest = m[2].trim();
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

function plainToDisplaySpec(plain: string): {kind: 'random'|'current', label: string}|null {
  const cleaned = plain.trim();
  const angled = angleToPlain(cleaned);
  const spec = angled ?? cleaned;
  const m = /^(r|c):(.+)$/.exec(spec);
  if (!m || !stringContainsRuntimeToken(spec)) {
    return null;
  }
  const kind = m[1] === 'r' ? 'random' : 'current';
  const rest = m[2];
  const argStart = rest.search(/[(\[]/);
  const rawName = argStart >= 0 ? rest.slice(0, argStart) : rest;
  const args = argStart >= 0 ? rest.slice(argStart) : '';
  const label = `${rawName.replace(/_/g, ' ')}${args}`;
  return {kind, label};
}

/** `r:uuid` / `<<c:date>>` → `{{random uuid}}` / `{{current date}}`. */
export function toDisplayRuntimeToken(value: string): string {
  const text = isLiteralTokenValue(value) ? unwrapLiteralToken(value) : value;
  const trimmed = text.trim();
  const already = displayTokenToPlain(trimmed);
  if (already) {
    const spec = plainToDisplaySpec(already);
    return spec ? `{{${spec.kind} ${spec.label}}}` : trimmed;
  }
  const fromAngle = angleToPlain(trimmed);
  const plain = fromAngle ??
      (WHOLE_PLAIN_RUNTIME_RE.test(trimmed) ? trimmed : null);
  if (!plain) {
    return trimmed;
  }
  const spec = plainToDisplaySpec(plain);
  return spec ? `{{${spec.kind} ${spec.label}}}` : trimmed;
}

/** @deprecated Use toDisplayRuntimeToken */
export const toAngleRuntimeToken = toDisplayRuntimeToken;

/** Plain `r:uuid` / `c:date` inside free text (not already `{{…}}` / `<<…>>`). */
const PLAIN_RUNTIME_GLOBAL_RE = new RegExp(
    `(?<![A-Za-z0-9_])((?:r|c):(?:${RUNTIME_TOKEN_SPEC_LOOSE_RE})${ACCESSOR_PATH_RE})(?![A-Za-z0-9_])`,
    'g',
);

/**
 * Rewrite every known r:/c: token in free text to `{{random …}}` / `{{current …}}`
 * (plain, `<<…>>`, or already-display forms).
 */
export function rewriteRuntimeTokensInText(text: string): string {
  let out = String(text ?? '');
  out = out.replace(DISPLAY_RUNTIME_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain ? toDisplayRuntimeToken(plain) : match;
  });
  out = out.replace(ANGLE_RUNTIME_GLOBAL_RE, (_match, plain: string) => {
    if (!stringContainsRuntimeToken(plain)) {
      return _match;
    }
    return toDisplayRuntimeToken(plain);
  });
  out = out.replace(PLAIN_RUNTIME_GLOBAL_RE, (match, plain: string) => {
    if (!stringContainsRuntimeToken(plain)) {
      return match;
    }
    return toDisplayRuntimeToken(plain);
  });
  return out;
}

/**
 * Convert body-editor display tokens to resolvable `<<r:…>>` / `<<c:…>>`
 * so Send / runner replaceAllRefs can expand them.
 */
export function displayRuntimeTokensToResolvableText(text: string): string {
  return String(text ?? '').replace(DISPLAY_RUNTIME_GLOBAL_RE, (match) => {
    const plain = displayTokenToPlain(match);
    return plain ? `<<${plain}>>` : match;
  });
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
 * (`{{random uuid}}`). Quotes are a JSON concern only.
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
    if (stringContainsRuntimeToken(value) || DISPLAY_RUNTIME_GLOBAL_RE.test(value)) {
      DISPLAY_RUNTIME_GLOBAL_RE.lastIndex = 0;
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
    if (WHOLE_DISPLAY_RUNTIME_RE.test(trimmed) || WHOLE_ANGLE_RUNTIME_RE.test(trimmed)) {
      const fromDisplay = displayTokenToPlain(trimmed);
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromAngle = angleToPlain(trimmed);
      if (fromAngle && stringContainsRuntimeToken(fromAngle)) {
        return fromAngle;
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
 * URLSearchParams percent-encodes `{{random uuid}}`. Restore known display
 * tokens so the urlencoded editor keeps readable `{{…}}` forms.
 */
export function restoreAngleRuntimeTokensInUrlEncoded(text: string): string {
  return String(text ?? '').replace(
      /%7B%7B(?:random|current)(?:[A-Za-z0-9_\-().+\s]|%[0-9A-Fa-f]{2})*%7D%7D/gi,
      (match) => {
        try {
          const decoded = decodeURIComponent(match.replace(/\+/g, '%20'));
          return displayTokenToPlain(decoded) ? decoded : match;
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

function jsonFormForRuntimePlain(plain: string): string {
  const display = toDisplayRuntimeToken(plain);
  if (runtimeTokenEmitsJsonString(plain)) {
    return JSON.stringify(display);
  }
  return display;
}

function writeJsonWithRuntimeTokens(value: unknown, space: number, level: number): string {
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
    if (isWholeBareRuntimeToken(value) || angleToPlain(value.trim()) ||
        displayTokenToPlain(value)) {
      const plain = displayTokenToPlain(value) ??
          angleToPlain(value.trim()) ?? value.trim();
      return jsonFormForRuntimePlain(plain);
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
    if (value.length === 0) {
      return '[]';
    }
    if (space <= 0) {
      return `[${value.map((item) => writeJsonWithRuntimeTokens(item, 0, 0)).join(',')}]`;
    }
    const innerIndent = ' '.repeat(space * (level + 1));
    const outerIndent = ' '.repeat(space * level);
    const parts = value.map(
        (item) => `${innerIndent}${writeJsonWithRuntimeTokens(item, space, level + 1)}`,
    );
    return `[\n${parts.join(',\n')}\n${outerIndent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }
    if (space <= 0) {
      return `{${
        entries
            .map(([k, v]) =>
              `${JSON.stringify(k)}:${writeJsonWithRuntimeTokens(v, 0, 0)}`)
            .join(',')
      }}`;
    }
    const innerIndent = ' '.repeat(space * (level + 1));
    const outerIndent = ' '.repeat(space * level);
    const parts = entries.map(
        ([k, v]) =>
          `${innerIndent}${JSON.stringify(k)}: ${
            writeJsonWithRuntimeTokens(v, space, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${outerIndent}}`;
  }
  return 'null';
}

/**
 * Pretty/compact JSON: string tokens as `"{{random uuid}}"`, number/bool as
 * bare `{{random int}}` / `{{random bool}}`.
 */
export function stringifyJsonWithRuntimeTokens(
    value: unknown,
    pretty: boolean = true,
): string {
  return writeJsonWithRuntimeTokens(value, pretty ? 2 : 0, 0);
}

/**
 * Replace unquoted `{{random …}}` / `{{current …}}` outside JSON strings.
 * `onToken` receives the plain `r:…` / `c:…` spec.
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
      const m = DISPLAY_RUNTIME_AT_RE.exec(slice);
      if (m) {
        const plain = displayTokenToPlain(m[0]);
        if (plain) {
          out += onToken(plain);
          i += m[0].length;
          continue;
        }
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
 * Find highlight ranges for `{{random …}}` / `{{current …}}` in body text.
 */
export function findDisplayRuntimeTokenRanges(text: string): TextPositionRange[] {
  if (!text) {
    return [];
  }
  const ranges: TextPositionRange[] = [];
  const re = new RegExp(DISPLAY_RUNTIME_GLOBAL_RE.source, 'gi');
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
  return ranges;
}

/** @deprecated Use findDisplayRuntimeTokenRanges */
export const findAngleRuntimeTokenRanges = findDisplayRuntimeTokenRanges;

/**
 * Tester UI string for a single field: prefer YAML `source` r:/c: markers as
 * `{{random …}}` / `{{current …}}`; otherwise show `resolved` as-is.
 * Quoted YAML literals (`__MMT_LITERAL__:…`) stay literal (not converted).
 */
export function displayRuntimeString(
    resolved: unknown,
    source?: unknown,
): string {
  if (typeof source === 'string') {
    if (isLiteralTokenValue(source)) {
      return `"${unwrapLiteralToken(source)}"`;
    }
    if (stringContainsRuntimeToken(source) || displayTokenToPlain(source) ||
        angleToPlain(source.trim())) {
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
