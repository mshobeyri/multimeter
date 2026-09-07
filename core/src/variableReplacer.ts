import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {normalizeTokenName} from './JSerHelper';
import {RANDOM_TOKEN_MAP} from './Random';
import {CURRENT_TOKEN_MAP} from './Current';
import {isOmitSentinel} from './omitKeyword';
import {safeList} from './safer';
import {TestData} from './TestData';

// ---------------------------------------------------------------------------
// Shared token helpers
//
// Supported forms for env/input/random/current/output references in .mmt files:
//   <<e:VAR>>          angle-bracket-wrapped
//   <e:VAR>            single-angle-bracket-wrapped (env only)
//   e:{VAR}            brace-wrapped (env only)
//   e:VAR              plain
//   <<o:name>> / o:name  test outputs object (runtime; not API doc annotations)
//
// Optional accessor suffixes are supported after the base token name:
//   <<i:message[0]>>   single index / first character
//   <<i:message[0:3]>> slice (string/array .slice semantics)
//   <<e:user.name>>    property access
//   <<o:user.name>>    nested outputs field
// ---------------------------------------------------------------------------

export const TOKEN_NAME_RE = '[A-Za-z_][A-Za-z0-9_\\-]*';
export const ACCESSOR_SEGMENT_RE =
    '(?:\\.[A-Za-z_][A-Za-z0-9_]*|\\[(?:-?\\d+(?::-?\\d*)?|:-?\\d*|[A-Za-z_][A-Za-z0-9_]*)\\])';
export const ACCESSOR_PATH_RE = `${ACCESSOR_SEGMENT_RE}*`;
const DYNAMIC_KEY_RE = `[A-Za-z0-9_]+:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}`;

function replaceTokenForms(
    s: string, prefix: string,
    formatter: (name: string, accessor: string, match: string) => string,
    options: {
      includeAngles?: boolean,
      includeSingleAngles?: boolean,
      includeBraceForm?: boolean,
      includePlain?: boolean,
    } = {}): string {
  const source = String(s ?? '');
  const capture = `(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})`;
  let out = source;

  if (options.includeAngles !== false) {
    out = out.replace(
        new RegExp(`<<\\s*${prefix}:${capture}\\s*>>`, 'g'),
        (match, name: string, accessor = '') => formatter(name, accessor || '', match));
  }
  if (options.includeSingleAngles) {
    out = out.replace(
        new RegExp(`<\\s*${prefix}:${capture}\\s*>`, 'g'),
        (match, name: string, accessor = '') => formatter(name, accessor || '', match));
  }
  if (options.includeBraceForm) {
    out = out.replace(
        new RegExp(`(?<![a-zA-Z0-9])${prefix}:\\{(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\}`, 'g'),
        (match, name: string, accessor = '') => formatter(name, accessor || '', match));
  }
  if (options.includePlain !== false) {
    out = out.replace(
        new RegExp(`(?<![a-zA-Z0-9])${prefix}:${capture}(?![A-Za-z0-9_])`, 'g'),
        (match, name: string, accessor = '') => formatter(name, accessor || '', match));
  }
  return out;
}

function splitTokenNameAccessor(raw: string): {name: string, accessor: string}|undefined {
  const m = new RegExp(`^(${TOKEN_NAME_RE})(.*)$`).exec(String(raw ?? '').trim());
  if (!m || !m[1]) {
    return undefined;
  }
  return {name: m[1], accessor: m[2] || ''};
}

/**
 * Apply a dotted/index/slice accessor path to a resolved token value.
 *
 * Supported accessors:
 * - `.field`
 * - `[0]`
 * - `[0:3]` (string/array slice)
 */
export function applyValueAccessor(value: any, accessor = ''): any {
  if (!accessor) {
    return value;
  }

  let current = value;
  let i = 0;
  while (i < accessor.length) {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (accessor[i] === '.') {
      const propMatch = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(accessor.slice(i));
      if (!propMatch || !propMatch[1]) {
        return undefined;
      }
      current = current[propMatch[1]];
      i += propMatch[0].length;
      continue;
    }

    if (accessor[i] === '[') {
      const close = accessor.indexOf(']', i);
      if (close === -1) {
        return undefined;
      }
      const raw = accessor.slice(i + 1, close).trim();
      if (raw.includes(':')) {
        const [startRaw, endRaw] = raw.split(':', 2);
        const start = startRaw === '' ? undefined : Number(startRaw);
        const end = endRaw === '' ? undefined : Number(endRaw);
        if ((startRaw !== '' && Number.isNaN(start)) ||
            (endRaw !== '' && Number.isNaN(end)) ||
            typeof current.slice !== 'function') {
          return undefined;
        }
        current = current.slice(start, end);
      } else if (/^-?\d+$/.test(raw)) {
        current = current[Number(raw)];
      } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
        current = current[raw];
      } else {
        return undefined;
      }
      i = close + 1;
      continue;
    }

    return undefined;
  }

  return current;
}

const escapeBackticks = (s: string): string =>
    String(s ?? '').replace(/`/g, '\\`');

const toSingleQuotedJsString = (s: string): string =>
    `'${String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;

const toJsAccessorExpression = (baseExpression: string, accessor = ''): string =>
    accessor ? `__mmt_access(${baseExpression}, ${JSON.stringify(accessor)})` : baseExpression;

/**
 * Normalize all env-token syntaxes to a JS expression rooted at `envVariables`.
 * Used when generating JS code outside template literals.
 */
export const normalizeEnvTokens = (s: string): string =>
    replaceTokenForms(
        s, 'e',
        (name, accessor) => toJsAccessorExpression(`envVariables.${name}`, accessor),
        {includeSingleAngles: true, includeBraceForm: true});

/**
 * Simple word-boundary env-token replacement: `e:VAR` → `envVariables.VAR`.
 * Only handles the plain `e:VAR` form (no angle/brace wrappers).
 * Useful for short expressions like conditional checks.
 */
export const replaceEnvTokensPlain = (s: string): string =>
    replaceTokenForms(
        s, 'e',
        (name, accessor) => toJsAccessorExpression(`envVariables.${name}`, accessor),
        {includeAngles: false, includeSingleAngles: false, includeBraceForm: false});

/**
 * Replace all env-token syntaxes in `s` with `${...}` JS interpolations.
 * Exported so urlencoded body encoding can turn `e:` tokens into runtime
 * placeholders *before* percent-encoding (JSON/XML keep them readable).
 */
export const replaceEnvTokensToJs = (s: string): string =>
    replaceTokenForms(
        s, 'e',
        (name, accessor) => '${' +
            toJsAccessorExpression(`envVariables.${name}`, accessor) + '}',
        {includeSingleAngles: true, includeBraceForm: true});

/**
 * Replace all r: / c: token syntaxes in `s` with runtime call expressions.
 */
export const replaceRandCurrentTokensToJs = (s: string): string => {
  let out = replaceTokenForms(
      s, 'r',
      (name, accessor) => '${' +
          toJsAccessorExpression(`__mmt_random('${name}')`, accessor) + '}',
      {includeSingleAngles: false, includeBraceForm: false});
  out = replaceTokenForms(
      out, 'c',
      (name, accessor) => '${' +
          toJsAccessorExpression(`__mmt_current('${name}')`, accessor) + '}',
      {includeSingleAngles: false, includeBraceForm: false});
  return out;
};

/**
 * Replace `i:` token syntaxes with `${inputName}` / `__mmt_access(...)`
 * interpolations so API/test default params can reference sibling inputs
 * (e.g. `xx: asd_<<i:message>>` → `` `asd_${message}` ``).
 */
export const replaceInputTokensToJs = (s: string): string =>
    replaceTokenForms(
        s, 'i',
        (name, accessor) =>
            '${' + toJsAccessorExpression(name, accessor) + '}',
        {includeSingleAngles: false, includeBraceForm: false});

/**
 * Replace `o:` / `<<o:…>>` tokens with `${outputs.…}` interpolations for
 * test codegen. API description annotations use the same spelling but are
 * not run through this helper (only tests call `replaceOutputTokenRefs`).
 */
export const replaceOutputTokensToJs = (s: string): string =>
    replaceTokenForms(
        s, 'o',
        (name, accessor) => '${' +
            toJsAccessorExpression(`outputs.${name}`, accessor) + '}',
        {includeSingleAngles: false, includeBraceForm: false});

/**
 * Plain `o:name` → `outputs.name` (no `${…}`), for check/if expressions.
 */
export const replaceOutputTokensPlain = (s: string): string =>
    replaceTokenForms(
        s, 'o',
        (name, accessor) => toJsAccessorExpression(`outputs.${name}`, accessor),
        {includeAngles: false, includeSingleAngles: false, includeBraceForm: false});

/**
 * Rewrite a `set` step key `o:user.name` to assignment LHS `outputs.user.name`.
 * Returns undefined when the key is not an `o:` token.
 */
export function rewriteOutputSetKey(key: string): string|undefined {
  const m = new RegExp(`^o:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`)
                .exec(String(key ?? ''));
  if (!m || !m[1]) {
    return undefined;
  }
  // Assignment LHS must be a direct path (not __mmt_access).
  return `outputs.${m[1]}${m[2] || ''}`;
}

/**
 * Deep-walk a value and convert `o:` / `<<o:…>>` string tokens to
 * `${outputs.…}` placeholders. Used for test files only.
 */
export function replaceOutputTokenRefs(value: any): any {
  if (typeof value === 'string') {
    return replaceOutputTokensToJs(value);
  }
  if (Array.isArray(value)) {
    return value.map(replaceOutputTokenRefs);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, replaceOutputTokenRefs(v)]));
  }
  return value;
}

/**
 * Convert remaining `e:` / `r:` / `c:` / `i:` / `o:` tokens in a string to `${...}`
 * interpolations (without wrapping in backticks).
 */
export const replaceDynamicTokensToJsInterpolations = (s: string): string => {
  let out = replaceEnvTokensToJs(String(s ?? ''));
  out = replaceRandCurrentTokensToJs(out);
  out = replaceInputTokensToJs(out);
  out = replaceOutputTokensToJs(out);
  return out;
};

/**
 * Deep-walk a value and convert remaining `e:` / `r:` / `c:` tokens in strings
 * to `${...}` interpolations. Used before urlencoded encoding so dynamic refs
 * survive URLSearchParams percent-encoding the same way JSON/XML bodies do.
 */
export function embedDynamicTokensAsJsInterpolations(value: any): any {
  if (typeof value === 'string') {
    return replaceDynamicTokensToJsInterpolations(value);
  }
  if (Array.isArray(value)) {
    return value.map(embedDynamicTokensAsJsInterpolations);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, embedDynamicTokensAsJsInterpolations(v)]));
  }
  return value;
}

/**
 * Convert a string value to a JS expression, resolving e:, r:, c:, i:, and o: tokens.
 *
 * If the **entire** string is a single token (e.g. `<<e:HOST>>`, `r:email`,
 * `<<i:message>>`, `<<o:token>>`), returns a bare JS expression. Otherwise
 * returns a backtick template literal with `${…}` interpolations.
 */
export function toTemplateValueJs(value: string): string {
  const s = String(value ?? '');

  const fullEnvAngle = new RegExp(`^<<\\s*e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`);
  const fullEnvPlain = new RegExp(`^e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`);
  const fullRandAngle = new RegExp(`^<<\\s*r:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`);
  const fullRandPlain = new RegExp(`^r:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`);
  const fullCurrAngle = new RegExp(`^<<\\s*c:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`);
  const fullCurrPlain = new RegExp(`^c:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`);
  const fullInputAngle = new RegExp(`^<<\\s*i:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`);
  const fullInputPlain = new RegExp(`^i:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`);
  const fullOutputAngle = new RegExp(`^<<\\s*o:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`);
  const fullOutputPlain = new RegExp(`^o:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`);

  let m = fullEnvAngle.exec(s) || fullEnvPlain.exec(s);
  if (m && m[1]) {
    return toJsAccessorExpression(`envVariables.${m[1]}`, m[2] || '');
  }
  m = fullRandAngle.exec(s) || fullRandPlain.exec(s);
  if (m && m[1]) {
    return toJsAccessorExpression(`__mmt_random('${m[1]}')`, m[2] || '');
  }
  m = fullCurrAngle.exec(s) || fullCurrPlain.exec(s);
  if (m && m[1]) {
    return toJsAccessorExpression(`__mmt_current('${m[1]}')`, m[2] || '');
  }
  m = fullInputAngle.exec(s) || fullInputPlain.exec(s);
  if (m && m[1]) {
    return toJsAccessorExpression(m[1], m[2] || '');
  }
  m = fullOutputAngle.exec(s) || fullOutputPlain.exec(s);
  if (m && m[1]) {
    return toJsAccessorExpression(`outputs.${m[1]}`, m[2] || '');
  }

  let result = replaceEnvTokensToJs(s);
  result = replaceRandCurrentTokensToJs(result);
  result = replaceInputTokensToJs(result);
  result = replaceOutputTokensToJs(result);
  return '`' + escapeBackticks(result) + '`';
}

/**
 * Build a JS template literal that resolves env tokens at runtime.
 */
export const toTemplateWithEnvVars = (s: string): string => {
  let withEnv = replaceEnvTokensToJs(String(s ?? ''));
  withEnv = withEnv.replace(
      /\$\{\s*\$\{\s*envVariables\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\s*\}/g,
      '${envVariables.$1}');
  return '`' + escapeBackticks(withEnv) + '`';
};

/**
 * Resolve env-token references against actual environment values at runtime.
 * Replaces all `e:` token forms in `s` using values from `envParams`.
 * If a token is not found in `envParams`, the original token text is kept.
 */
export const resolveEnvTokenValues =
    (s: string, envParams: Record<string, any>): string =>
        replaceTokenForms(
            s, 'e',
            (name, accessor, match) => {
              const value = applyValueAccessor(envParams[name], accessor);
              return value !== undefined ? String(value) : match;
            },
            {includeSingleAngles: true, includeBraceForm: true});

// Replacement modes enum
enum ReplacementMode {
  BRACE = 'brace',    // <key> format
  QUOTES = 'quotes',  // "key" format
  NONE = 'none'       // key format
}

type DynamicResolver = (key: string) => any | undefined;

// Cache for random token results to keep UI stable across re-renders
const RANDOM_CACHE = new Map<string, any>();
export function resetRandomTokenCache(): void { RANDOM_CACHE.clear(); }

function generateRandomByName(name: string): any {
  const normalized = normalizeTokenName(name);
  const cacheKey = `r:${normalized}`;
  if (RANDOM_CACHE.has(cacheKey)) {
    return RANDOM_CACHE.get(cacheKey);
  }
  const fn = RANDOM_TOKEN_MAP[normalized] || RANDOM_TOKEN_MAP[name];
  if (!fn) {
    return undefined;
  }
  const val = fn();
  RANDOM_CACHE.set(cacheKey, val);
  return val;
}

// Cache for current token results to keep UI stable across re-renders (single evaluation per render cycle)
const CURRENT_CACHE = new Map<string, any>();
export function resetCurrentTokenCache(): void { CURRENT_CACHE.clear(); }

function generateCurrentByName(name: string): any {
  const normalized = normalizeTokenName(name);
  const cacheKey = `current:${normalized}`;
  if (CURRENT_CACHE.has(cacheKey)) {
    return CURRENT_CACHE.get(cacheKey);
  }
  const fn = CURRENT_TOKEN_MAP[normalized] || CURRENT_TOKEN_MAP[name];
  if (!fn) {
    return undefined;
  }
  const val = fn();
  CURRENT_CACHE.set(cacheKey, val);
  return val;
}

const INPUT_TOKEN_IN_STRING_RE = new RegExp(
    `<<\\s*i:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}\\s*>>|(?<![a-zA-Z0-9])i:${TOKEN_NAME_RE}${ACCESSOR_PATH_RE}(?![A-Za-z0-9_])`);

/**
 * Expand nested `i:` tokens inside a resolved sibling value before accessors
 * like `[1:2]` are applied. Without this, multi-level chains can slice the
 * literal `<<i:…>>` text on an early pass and never recover.
 */
function resolveNestedInputTokens(
    val: any, mergedInputs: Record<string, any>, envs: Record<string, any>,
    visiting: Set<string>, depth = 0): any {
  if (depth > 8 || typeof val !== 'string' || !INPUT_TOKEN_IN_STRING_RE.test(val)) {
    return val;
  }
  const out = replaceAllRefs({v: val}, {}, mergedInputs, envs, visiting).v;
  if (out === val) {
    return out;
  }
  return resolveNestedInputTokens(out, mergedInputs, envs, visiting, depth + 1);
}

function resolveDynamicTokenValue(
    prefix: string, name: string, accessor: string,
    mergedInputs: Record<string, any>, envs: Record<string, any>,
    visiting: Set<string> = new Set()): any {
  switch (prefix) {
    case 'i': {
      if (visiting.has(name)) {
        return undefined;
      }
      const rawInputValue = mergedInputs[name];
      const placeholderMatch = typeof rawInputValue === 'string' ?
        /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(rawInputValue) :
        null;
      // During JS generation we pass `${inputName}` placeholders as defaults.
      // Accessors must be applied to the runtime variable, not sliced from the
      // placeholder text itself (e.g. `${role}` -> `${r`).
      if (placeholderMatch && placeholderMatch[1]) {
        if (!accessor) {
          return rawInputValue;
        }
        return `\${__mmt_access(${placeholderMatch[1]}, ${toSingleQuotedJsString(accessor)})}`;
      }
      visiting.add(name);
      let resolved = resolveEmbeddedTokens(rawInputValue, envs);
      if (isOmitSentinel(resolved)) {
        visiting.delete(name);
        return resolved;
      }
      resolved = resolveNestedInputTokens(resolved, mergedInputs, envs, visiting);
      visiting.delete(name);
      return applyValueAccessor(resolved, accessor);
    }
    case 'e':
      return applyValueAccessor(envs[name], accessor);
    case 'r':
      return applyValueAccessor(generateRandomByName(name), accessor);
    case 'c':
      return applyValueAccessor(generateCurrentByName(name), accessor);
    default:
      return undefined;
  }
}

export function resolveEmbeddedTokens(val: any, envs: Record<string, any>): any {
  if (typeof val === 'string') {
    const exactMatchers = [
      {re: new RegExp(`^<<\\s*r:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`), prefix: 'r'},
      {re: new RegExp(`^r:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`), prefix: 'r'},
      {re: new RegExp(`^<<\\s*c:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`), prefix: 'c'},
      {re: new RegExp(`^c:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`), prefix: 'c'},
      {re: new RegExp(`^<<\\s*e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>$`), prefix: 'e'},
      {re: new RegExp(`^e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})$`), prefix: 'e'},
    ];

    for (const {re, prefix} of exactMatchers) {
      const match = re.exec(val);
      if (match && match[1]) {
        const resolved = resolveDynamicTokenValue(prefix, match[1], match[2] || '', {}, envs);
        return resolved !== undefined ? resolved : val;
      }
    }

    let out = replaceTokenForms(
        val, 'r',
        (name, accessor, match) => {
          const resolved = resolveDynamicTokenValue('r', name, accessor, {}, envs);
          return resolved !== undefined ? String(resolved) : match;
        },
        {includeSingleAngles: false, includeBraceForm: false});
    out = replaceTokenForms(
        out, 'c',
        (name, accessor, match) => {
          const resolved = resolveDynamicTokenValue('c', name, accessor, {}, envs);
          return resolved !== undefined ? String(resolved) : match;
        },
        {includeSingleAngles: false, includeBraceForm: false});
    out = replaceTokenForms(
        out, 'e',
        (name, accessor, match) => {
          const resolved = resolveDynamicTokenValue('e', name, accessor, {}, envs);
          return resolved !== undefined ? String(resolved) : match;
        },
        {includeSingleAngles: true, includeBraceForm: true});
    return out;
  }
  if (Array.isArray(val)) {
    return safeList(val).map(v => resolveEmbeddedTokens(v, envs));
  }
  if (val && typeof val === 'object') {
    return Object.fromEntries(
        safeList(Object.entries(val)).map(([k, v]) => [k, resolveEmbeddedTokens(v, envs)]));
  }
  return val;
}

function replaceRefs(
    obj: any, pattern: RegExp, mode: ReplacementMode,
    inputs: Record<string, any>, resolver?: DynamicResolver): any {
  if (typeof obj === 'string') {
    // Build anchored (non-global) pattern for full-string variable match based
    const anchored = mode === ReplacementMode.BRACE ?
      new RegExp(`^<<(${DYNAMIC_KEY_RE})>>$`) :
      new RegExp(`^(${DYNAMIC_KEY_RE})$`);

    const full = anchored.exec(obj);
    if (full && full[1]) {
      const key = full[1];
      let found = inputs[key];
      if (found === undefined && resolver) {
        found = resolver(key);
      }
      if (found !== undefined) {
        // Return the original type for complete string replacement
        return found;
      }
      // If not found, preserve the original token text
      return obj;
    }

    // For partial replacements or multiple matches, convert to string.
    if (mode === ReplacementMode.NONE) {
      // Pattern is `(:\s*)(key)` – only replace values after a colon+space.
      return obj.replace(pattern, (match, prefix: string, key: string) => {
        let found = inputs[key];
        if (found === undefined && resolver) {
          found = resolver(key);
        }
        if (found === undefined) {
          return prefix + key;
        }
        return prefix + String(found);
      });
    }

    // BRACE mode keeps the previous behavior (no prefix group).
    return obj.replace(pattern, (match, key: string) => {
      let found = inputs[key];
      if (found === undefined && resolver) {
        found = resolver(key);
      }
      if (found === undefined) {
        return match;
      }
      return String(found);
    });
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return safeList(obj).map(item => replaceRefs(item, pattern, mode, inputs, resolver));
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
        safeList(Object.entries(obj))
            .map(([k, v]) => [k, replaceRefs(v, pattern, mode, inputs, resolver)]));
  }

  return obj;
}

/**
 * Recursively scan an object for `i:name` input references and return the
 * unique set of referenced input names.
 * Detects both `<<i:name>>` (brace form) and standalone `i:name` (value form).
 */
export function collectInputRefsFromObject(obj: any): string[] {
  const refs = new Set<string>();

  function extractFromString(value: string): void {
    // Full-string match: value is exactly `i:name` (optionally with accessors)
    const fullNone = new RegExp(`^i:([a-zA-Z0-9_]+)(?:${ACCESSOR_SEGMENT_RE})*$`).exec(value);
    if (fullNone) {
      refs.add(fullNone[1]);
      return;
    }

    // Full-string brace match: value is exactly `<<i:name>>` (optionally with accessors)
    const fullBrace = new RegExp(`^<<i:([a-zA-Z0-9_]+)(?:${ACCESSOR_SEGMENT_RE})*>>$`).exec(value);
    if (fullBrace) {
      refs.add(fullBrace[1]);
      return;
    }

    // Partial brace matches: <<i:name>> anywhere in string
    const braceRe = new RegExp(`<<i:([a-zA-Z0-9_]+)(?:${ACCESSOR_SEGMENT_RE})*>>`, 'g');
    let m;
    while ((m = braceRe.exec(value)) !== null) {
      refs.add(m[1]);
    }

    // After colon-space: `: i:name` (matches the NONE-mode global pattern)
    const afterColonRe = new RegExp(`:\\si:([a-zA-Z0-9_]+)(?:${ACCESSOR_SEGMENT_RE})*`, 'g');
    while ((m = afterColonRe.exec(value)) !== null) {
      refs.add(m[1]);
    }
  }

  function scan(value: any): void {
    if (typeof value === 'string') {
      extractFromString(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        scan(item);
      }
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) {
        scan(v);
      }
    }
  }

  scan(obj);
  return Array.from(refs);
}

// Specific replacers using flags
export function replaceInputRefsWithBrace(obj: any, inputs: any, resolver?: DynamicResolver): any {
  return replaceRefs(
      obj, new RegExp(`<<(${DYNAMIC_KEY_RE})>>`, 'g'), ReplacementMode.BRACE, inputs, resolver);
}

export function replaceInputRefsWithNone(obj: any, inputs: any, resolver?: DynamicResolver): any {
  // Only replace plain tokens when they occur as values after a literal
  // colon+space (" : "), e.g. "key: i:foo". This ensures patterns like
  // "hi:i:foo" are not touched.
  return replaceRefs(
      obj, new RegExp(`(:\\s)(${DYNAMIC_KEY_RE})`, 'g'), ReplacementMode.NONE,
      inputs, resolver);
}

// Replaces all references (inputs first, then environment vars)
export function replaceAllRefs(
    iface: any, defaults: JSONRecord, inputs: JSONRecord,
    envs: JSONRecord, visiting: Set<string> = new Set()): any {
  const mergedInputs = Object.assign({}, defaults, inputs);

  // Dynamic resolver for i:, e:, r:, c:
  const dynamicResolver: DynamicResolver = (fullKey: string) => {
    const idx = fullKey.indexOf(':');
    if (idx <= 0) {
      return undefined;
    }
    const prefix = fullKey.slice(0, idx);
    const parsed = splitTokenNameAccessor(fullKey.slice(idx + 1));
    if (!parsed) {
      return undefined;
    }
    return resolveDynamicTokenValue(
        prefix, parsed.name, parsed.accessor, mergedInputs, envs, visiting);
  };

  // Use resolver; no need to pre-prefix i:/e:/r:/c:
  let replacedIface = replaceInputRefsWithBrace(iface, {}, dynamicResolver);
  replacedIface = replaceInputRefsWithNone(replacedIface, {}, dynamicResolver);

  return replacedIface;
}

function inputsMapsEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (a[key] !== b[key]) {
      try {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * Resolve an inputs map against env/random/current tokens and sibling `i:` refs.
 *
 * Supports interdependent defaults such as:
 *   card: e:card
 *   seq: e:seq
 *   id: <<i:card>>_<<i:seq>>
 *   short: <<i:card[0:4]>>
 *   nested: <<i:short>>_x
 *
 * Multiple passes let `i:` values that reference other inputs settle after
 * those siblings have been expanded (including accessors like `[1:2]`).
 */
export function resolveInputsMap(
    inputs: Record<string, any>|null|undefined,
    envs: Record<string, any> = {},
    maxPasses = 8): Record<string, any> {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return {};
  }
  let current: Record<string, any> = {...inputs};
  const passes = Math.max(1, maxPasses);
  for (let i = 0; i < passes; i++) {
    const nextWrapper = replaceAllRefs({inputs: current}, {}, current, envs);
    const next = (nextWrapper && typeof nextWrapper.inputs === 'object' &&
                  !Array.isArray(nextWrapper.inputs)) ?
        {...nextWrapper.inputs} :
        {};
    if (inputsMapsEqual(current, next)) {
      return next;
    }
    current = next;
  }
  return current;
}