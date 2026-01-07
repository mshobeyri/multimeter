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

const normalizeWindowsDriveSlashes = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  // vscode / file URIs can yield "/C:/..."; normalize to "C:/..." so helpers
  // treat it as a real drive path.
  if (/^\/[A-Za-z]:\//.test(s)) {
    return s.slice(1);
  }
  return s;
};

export const fileUriToPath = (p: string): string => {
  const s = String(p ?? '');
  if (!s) {
    return '';
  }
  if (/^file:\/\//i.test(s)) {
    try {
      return decodeURIComponent(s.replace(/^file:\/\/+/, '/'));
    } catch {
      return s.replace(/^file:\/\/+/, '/');
    }
  }
  return s;
};

export const isAbsPath = (p: string): boolean => {
  const s = String(p ?? '').replace(/\\/g, '/');
  return s.startsWith('/') || /^[A-Za-z]:\//.test(s);
};

export const dirnamePath = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, idx);
};

export const joinPath = (a: string, b: string): string => {
  const left = String(a ?? '').replace(/\\/g, '/');
  const right = String(b ?? '').replace(/\\/g, '/');
  if (!left || left === '.') {
    return right;
  }
  if (!right) {
    return left;
  }
  if (left.endsWith('/')) {
    return left + right;
  }
  return left + '/' + right;
};

export const resolveDotSegments = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const abs = s.startsWith('/') || /^[A-Za-z]:\//.test(s);
  const parts = s.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else if (!abs) {
        out.push('..');
      }
      continue;
    }
    out.push(part);
  }
  const prefix = abs && s.startsWith('/') ? '/' : '';
  return prefix + out.join('/');
};

export const resolveRequestedAgainst = (
    baseFilePath: string|undefined, requested: string): string => {
  const reqRaw = String(requested ?? '').trim();
  if (!reqRaw) {
    return '';
  }
  const requestedPath = fileUriToPath(reqRaw);
  if (!requestedPath) {
    return '';
  }
  if (isAbsPath(requestedPath)) {
    return resolveDotSegments(requestedPath);
  }
  const baseDir = baseFilePath ? dirnamePath(fileUriToPath(baseFilePath)) : '.';
  return resolveDotSegments(joinPath(baseDir, requestedPath));
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

  const fullStr = normalizeWindowsDriveSlashes(stripFileUri(full));

  if (!base) {
    return fullStr;
  }

  let baseStr = normalizeWindowsDriveSlashes(stripFileUri(base));

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

  // Windows: if paths are on different drives, there is no meaningful
  // relative-with-.. representation. Return the normalized absolute `full`.
  const baseDrive = /^[A-Za-z]:$/.test(a[0] || '') ? (a[0] as string) : '';
  const fullDrive = /^[A-Za-z]:$/.test(b[0] || '') ? (b[0] as string) : '';
  if (baseDrive && fullDrive && baseDrive.toLowerCase() !== fullDrive.toLowerCase()) {
    return fullStr;
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

export default {computeRelative, resolveRequestedAgainst};
