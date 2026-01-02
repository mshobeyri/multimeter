import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {RANDOM_TOKEN_MAP} from './Random';
import {CURRENT_TOKEN_MAP} from './Current';
import {safeList} from './safer';
import {TestData} from './TestData';

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

function normalizeTokenName(name: string): string {
  return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
}

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

function resolveEmbeddedTokens(val: any, envs: Record<string, any>): any {
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
      // If not found, return the key literal
      return key;
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
        return key;
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