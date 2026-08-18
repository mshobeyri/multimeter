export const TEMP_MMT_SCHEME = 'mmt-temp';
export const TEMP_MMT_MARKER = '/.mmt-temp/';

export interface ParsedTempMmtPath {
  id: string;
  fileName: string;
}

export interface TempMmtUriParts {
  authority: string;
  path: string;
}

/** Short virtual URI parts: tab shows only the file name, not a folder path. */
export function buildTempMmtUriParts(
    id: string, fileName: string): TempMmtUriParts {
  const safeId = String(id || '').replace(/[\\/]+/g, '');
  const safeName = String(fileName || 'untitled.mmt').replace(/[\\/]+/g, '');
  return {authority: safeId, path: `/${safeName}`};
}

export function parseTempMmtUriParts(
    authority: string, posixPath: string): ParsedTempMmtPath|undefined {
  const id = String(authority || '').replace(/[\\/]+/g, '');
  const path = normalizePosixPath(posixPath);
  const baseName = path.replace(/^\//, '');
  if (id && baseName && !baseName.includes('/')) {
    return {id, fileName: baseName};
  }
  return parseTempMmtPath(path);
}

/** Legacy path form used before tabs were shortened. */
export function parseTempMmtPath(posixPath: string): ParsedTempMmtPath|undefined {
  const path = normalizePosixPath(posixPath);
  if (!path) {
    return undefined;
  }
  const markerAt = path.indexOf(TEMP_MMT_MARKER);
  if (markerAt >= 0) {
    const rest = path.slice(markerAt + TEMP_MMT_MARKER.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) {
      return undefined;
    }
    return {id: rest.slice(0, slash), fileName: rest.slice(slash + 1)};
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) {
    return undefined;
  }
  return {id: parts[0], fileName: parts.slice(1).join('/')};
}

function normalizePosixPath(raw: string): string {
  let path = String(raw || '').replace(/\\/g, '/').trim();
  if (!path) {
    return '';
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}
