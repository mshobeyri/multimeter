const ensureTrailingSep = (p?: string) => {
  if (!p) {
    return '';
  }
  return p.endsWith('/') || p.endsWith('\\') ? p : p + '/';
};

const stripFileUri = (p: string) => {
  if (!p) {
    return p;
  }
  // If starts with file:// or file:/// remove the scheme and keep leading slash
  if (/^file:\/\//i.test(p)) {
    return p.replace(/^file:\/\/+/, '/');
  }
  return p;
};

/**
 * Compute a concise path for display relative to `base` when possible.
 * - Accepts `base` in the form of a filesystem path or a `file://` URI.
 * - If `base` points to a file, its directory is used as the base.
 * - If `full` is under the base directory, return the remainder.
 * - Otherwise, return the remainder after the longest common path prefix
 *   (so sibling folders under a shared workspace root yield a shorter path).
 * - Falls back to returning the original `full` when no common prefix exists.
 */
export const computeRelative = (base?: string, full?: string): string => {
  if (!full) {
    return '';
  }

  const fullStr = stripFileUri(full).replace(/\\/g, '/');

  if (!base) {
    return fullStr;
  }

  let baseStr = stripFileUri(base).replace(/\\/g, '/');

  // If base is a file (heuristic: has a dot after the last slash), use its
  // directory
  if (!baseStr.endsWith('/')) {
    const lastSlash = baseStr.lastIndexOf('/');
    const lastDot = baseStr.lastIndexOf('.');
    if (lastDot > lastSlash) {
      baseStr = baseStr.slice(0, lastSlash + 1);
    } else {
      baseStr = ensureTrailingSep(baseStr);
    }
  }

  const baseNorm = ensureTrailingSep(baseStr);

  if (fullStr.startsWith(baseNorm)) {
    const rel = fullStr.slice(baseNorm.length);
    return rel || '.';
  }

  const a = baseNorm.split('/').filter(Boolean);
  const b = fullStr.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }

  // If the full path is directly under the base (already handled above), or
  // they are identical prefixes, handle those cases
  if (i === a.length && i === b.length) {
    return '.';
  }

  // If no common prefix, walk up from base to root then append full
  if (i === 0) {
    const up = a.map(() => '..').join('/');
    return (up ? up + '/' : '') + b.join('/');
  }

  const upCount = a.length - i;
  const up = Array(upCount).fill('..').join('/');
  const remainder = b.slice(i).join('/');
  return (up ? up + '/' : '') + (remainder || '.');
};

export default {computeRelative};
