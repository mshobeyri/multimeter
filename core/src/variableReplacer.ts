import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {normalizeTokenName} from './JSerHelper';
import {RANDOM_TOKEN_MAP} from './Random';
import {CURRENT_TOKEN_MAP} from './Current';
import {safeList} from './safer';
import {TestData} from './TestData';

// ---------------------------------------------------------------------------
// Shared env-token helpers
//
// All forms of env variable references in .mmt files:
//   <<e:VAR>>   angle-bracket-wrapped
//   <e:VAR>     single-angle-bracket-wrapped
//   e:{VAR}     brace-wrapped
//   e:VAR       plain
// ---------------------------------------------------------------------------

/**
 * Normalize all env-token syntaxes to a plain JS reference `envVariables.VAR`.
 * Used when generating JS code (outside template literals).
 */
export const normalizeEnvTokens = (s: string): string =>
    s.replace(/<<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>>/g, 'envVariables.$1')
        .replace(/<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>/g, 'envVariables.$1')
        .replace(/\be:\{([A-Za-z_][A-Za-z0-9_]*)\}/g, 'envVariables.$1')
        .replace(
            /(?<![a-zA-Z0-9])e:([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_])/g,
            'envVariables.$1');

/**
 * Simple word-boundary env-token replacement: `e:VAR` → `envVariables.VAR`.
 * Only handles the plain `e:VAR` form (no angle/brace wrappers).
 * Useful for short expressions like conditional checks.
 */
export const replaceEnvTokensPlain = (s: string): string =>
    s.replace(/(?<![a-zA-Z0-9])e:([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_])/g, 'envVariables.$1');

const escapeBackticks = (s: string): string =>
    String(s ?? '').replace(/`/g, '\\`');

/**
 * Replace all env-token syntaxes in `s` with `${envVariables.NAME}`.
 * Order: most-delimited → least-delimited to avoid greedy capture on
 * adjacent tokens separated by `_` or similar identifier characters.
 */
const replaceEnvTokensToJs = (s: string): string =>
    s.replace(/<<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>>/g, '${envVariables.$1}')
        .replace(/<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>/g, '${envVariables.$1}')
        .replace(/\be:\{([A-Za-z_][A-Za-z0-9_]*)\}/g, '${envVariables.$1}')
        .replace(
            /(?<![a-zA-Z0-9])e:([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_])/g,
            '${envVariables.$1}');

/**
 * Replace all r: / c: token syntaxes in `s` with runtime call expressions.
 */
const replaceRandCurrentTokensToJs = (s: string): string =>
    s.replace(/<<r:([A-Za-z_][A-Za-z0-9_\-]*)>>/g, "${__mmt_random('$1')}")
        .replace(
            /\br:([A-Za-z_][A-Za-z0-9_\-]*)(?![A-Za-z0-9_\-])/g,
            "${__mmt_random('$1')}")
        .replace(/<<c:([A-Za-z_][A-Za-z0-9_\-]*)>>/g, "${__mmt_current('$1')}")
        .replace(
            /\bc:([A-Za-z_][A-Za-z0-9_\-]*)(?![A-Za-z0-9_\-])/g,
            "${__mmt_current('$1')}");

/**
 * Convert a string value to a JS expression, resolving e:, r:, and c: tokens.
 *
 * If the **entire** string is a single token (e.g. `<<e:HOST>>`, `r:email`),
 * returns a bare JS expression (`envVariables.HOST`, `__mmt_random('email')`).
 * Otherwise returns a backtick template literal with `${…}` interpolations.
 *
 * Used by code-generation helpers to turn .mmt input values into JS.
 */
export function toTemplateValueJs(value: string): string {
  const s = String(value ?? '');

  // Full-match short-circuits: the entire value is one token → bare expression
  const fullEnvAngle = /^<<e:([A-Za-z_][A-Za-z0-9_]*)>>$/;
  const fullEnvPlain = /^e:([A-Za-z_][A-Za-z0-9_]*)$/;
  const fullRandAngle = /^<<r:([A-Za-z_][A-Za-z0-9_\-]*)>>$/;
  const fullRandPlain = /^r:([A-Za-z_][A-Za-z0-9_\-]*)$/;
  const fullCurrAngle = /^<<c:([A-Za-z_][A-Za-z0-9_\-]*)>>$/;
  const fullCurrPlain = /^c:([A-Za-z_][A-Za-z0-9_\-]*)$/;

  let m = fullEnvAngle.exec(s) || fullEnvPlain.exec(s);
  if (m && m[1]) {
    return `envVariables.${m[1]}`;
  }
  m = fullRandAngle.exec(s) || fullRandPlain.exec(s);
  if (m && m[1]) {
    return `__mmt_random('${m[1]}')`;
  }
  m = fullCurrAngle.exec(s) || fullCurrPlain.exec(s);
  if (m && m[1]) {
    return `__mmt_current('${m[1]}')`;
  }

  // Partial occurrences → template literal
  let result = replaceEnvTokensToJs(s);
  result = replaceRandCurrentTokensToJs(result);
  return '`' + escapeBackticks(result) + '`';
}

/**
 * Build a JS template literal that resolves env tokens at runtime.
 *
 * Examples:
 * - `"hello e:NAME"`   → `` `hello ${envVariables.NAME}` ``
 * - `"<<e:NAME>>"`     → `` `${envVariables.NAME}` ``
 *
 * Handles all env-token syntaxes and preserves existing `${…}` expressions
 * (e.g. `${callId.result_code}`).
 */
export const toTemplateWithEnvVars = (s: string): string => {
  let withEnv = replaceEnvTokensToJs(String(s ?? ''));
  // Collapse nested ${${...}} patterns if any
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
    (s: string, envParams: Record<string, any>): string => {
      const resolver = (_m: string, name: string) => {
        const val = envParams[name];
        return val !== undefined ? String(val) : _m;
      };
      return s
          .replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, resolver)
          .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, resolver)
          .replace(/\be:\{([A-Za-z0-9_]+)\}/g, resolver)
          .replace(/(?<![a-zA-Z0-9])e:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, resolver);
    };

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

export function resolveEmbeddedTokens(val: any, envs: Record<string, any>): any {
  if (typeof val === 'string') {
    // Full matches first (random or environment) preserve original type
    const fullRandomAngle = /^<<r:([a-zA-Z0-9_\-]+)>>$/;
    const fullRandomPlain = /^r:([a-zA-Z0-9_\-]+)$/;
    const fullCurrentAngle = /^<<c:([a-zA-Z0-9_\-]+)>>$/;
    const fullCurrentPlain = /^c:([a-zA-Z0-9_\-]+)$/;
    const fullEnvAngle = /^<<e:([a-zA-Z0-9_\-]+)>>$/;
    const fullEnvPlain = /^e:([a-zA-Z0-9_\-]+)$/;

    let m = fullRandomAngle.exec(val) || fullRandomPlain.exec(val);
    if (m && m[1]) {
      const v = generateRandomByName(m[1]);
      return v !== undefined ? v : val;
    }
    m = fullCurrentAngle.exec(val) || fullCurrentPlain.exec(val);
    if (m && m[1]) {
      const v = generateCurrentByName(m[1]);
      return v !== undefined ? v : val;
    }
    m = fullEnvAngle.exec(val) || fullEnvPlain.exec(val);
    if (m && m[1]) {
      const ev = envs[m[1]];
      return ev !== undefined ? ev : val;
    }
    // Partial occurrences: replace r:/e: inline, stringify results
    return val.replace(/<<r:([a-zA-Z0-9_\-]+)>>|r:([a-zA-Z0-9_\-]+)|<<c:([a-zA-Z0-9_\-]+)>>|c:([a-zA-Z0-9_\-]+)|<<e:([a-zA-Z0-9_\-]+)>>|e:([a-zA-Z0-9_\-]+)/g,
        (match, r1, r2, c1, c2, e1, e2) => {
          const rKey = r1 || r2;
          if (rKey) {
            const v = generateRandomByName(rKey);
            return v !== undefined ? String(v) : match;
          }
          const cKey = c1 || c2;
          if (cKey) {
            const v = generateCurrentByName(cKey);
            return v !== undefined ? String(v) : match;
          }
          const eKey = e1 || e2;
          if (eKey) {
            const ev = envs[eKey];
            return ev !== undefined ? String(ev) : match;
          }
          return match;
        });
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
      /^<<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>>$/ :
      /^([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)$/;

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
    // Full-string match: value is exactly `i:name`
    const fullNone = /^i:([a-zA-Z0-9_]+)$/.exec(value);
    if (fullNone) {
      refs.add(fullNone[1]);
      return;
    }

    // Full-string brace match: value is exactly `<<i:name>>`
    const fullBrace = /^<<i:([a-zA-Z0-9_]+)>>$/.exec(value);
    if (fullBrace) {
      refs.add(fullBrace[1]);
      return;
    }

    // Partial brace matches: <<i:name>> anywhere in string
    const braceRe = /<<i:([a-zA-Z0-9_]+)>>/g;
    let m;
    while ((m = braceRe.exec(value)) !== null) {
      refs.add(m[1]);
    }

    // After colon-space: `: i:name` (matches the NONE-mode global pattern)
    const afterColonRe = /:\si:([a-zA-Z0-9_]+)/g;
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
      obj, /<<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>>/g, ReplacementMode.BRACE, inputs, resolver);
}

export function replaceInputRefsWithNone(obj: any, inputs: any, resolver?: DynamicResolver): any {
  // Only replace plain tokens when they occur as values after a literal
  // colon+space (" : "), e.g. "key: i:foo". This ensures patterns like
  // "hi:i:foo" are not touched.
  return replaceRefs(
      obj, /(:\s)([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)/g, ReplacementMode.NONE,
      inputs, resolver);
}

// Replaces all references (inputs first, then environment vars)
export function replaceAllRefs(
    iface: any, defaults: JSONRecord, inputs: JSONRecord,
    envs: JSONRecord): any {
  const mergedInputs = Object.assign({}, defaults, inputs);

  // Dynamic resolver for i:, e:, r:, c:
  const dynamicResolver: DynamicResolver = (fullKey: string) => {
    const idx = fullKey.indexOf(':');
    if (idx <= 0) {
      return undefined;
    }
    const prefix = fullKey.slice(0, idx);
    const name = fullKey.slice(idx + 1);

    switch (prefix) {
      case 'i':
        // input/default/example values: resolve embedded r:/e:
        return resolveEmbeddedTokens(mergedInputs[name], envs);
      case 'e':
        // environment
        return envs[name];
      case 'r': {
        // random token via RANDOM_TOKEN_MAP with normalization + caching
        return generateRandomByName(name);
      }
      case 'c': {
        // current token via CURRENT_TOKEN_MAP with normalization + caching
        return generateCurrentByName(name);
      }
      default:
        return undefined;
    }
  };

  // Use resolver; no need to pre-prefix i:/e:/r:/c:
  let replacedIface = replaceInputRefsWithBrace(iface, {}, dynamicResolver);
  replacedIface = replaceInputRefsWithNone(replacedIface, {}, dynamicResolver);

  return replacedIface;
}