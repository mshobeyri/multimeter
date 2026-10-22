/**
 * Recover incomplete YAML scalars that the parser turns into nested maps.
 *
 * While typing URLs/schemes, values like `http:` / `https:` / `ws:` are parsed as
 * `{ http: null }` (compact nested mapping) instead of the string `"http:"`.
 * If more keys follow on the next lines, they can be swallowed into the same map
 * (`url: http:` + `method: get` → `{ http: null, method: "get" }`).
 */
const SCHEME_LIKE_KEY = /^(https?|wss?|ftp|file|grpc|grpcs)$/i;

export function normalizeIncompleteYamlScalar(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && (obj[keys[0]] === null || obj[keys[0]] === undefined)) {
      return `${keys[0]}:`;
    }
    const schemeKey = keys.find(
        (k) => SCHEME_LIKE_KEY.test(k) && (obj[k] === null || obj[k] === undefined));
    if (schemeKey) {
      return `${schemeKey}:`;
    }
    return undefined;
  }
  return undefined;
}

/** Like normalizeIncompleteYamlScalar, but always returns a string (empty when unknown). */
export function coerceYamlString(value: unknown, fallback = ''): string {
  return normalizeIncompleteYamlScalar(value) ?? fallback;
}
