'use strict';

/**
 * Normalize user/FS paths for CLI + pkg file loading.
 *
 * Accepts Windows and POSIX-style inputs:
 *   - / and \ separators
 *   - // and \\ (collapsed, except UNC \\server\share)
 *   - drive letters: c:\foo, c:/foo, C:\\foo, c:foo
 *   - relative parent segments: ../file.mmt, ..\..\env\multimeter.mmt
 *
 * On non-Windows hosts, drive-letter / UNC strings are still normalized so
 * generated/core paths that look Windows-shaped can be rewritten consistently
 * when the process later runs on Windows.
 */

/**
 * @param {string} input
 * @returns {string}
 */
function normalizeUserPath(input) {
  let s = String(input == null ? '' : input).trim();
  if (!s) {
    return s;
  }

  // Strip one layer of matching quotes (shell / YAML).
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  const looksWindows =
      process.platform === 'win32' ||
      s.includes('\\') ||
      /^[a-zA-Z]:[\\/]?/.test(s) ||
      /^[\\/]{2}[^\\/]/.test(s);

  if (!looksWindows) {
    // POSIX: collapse duplicate slashes but keep a single leading /.
    if (s.startsWith('//') && !s.startsWith('///')) {
      // Treat //host/... as UNC-like only on Windows; on POSIX keep as-is
      // except collapse ///+ inside.
      return s.replace(/\/{2,}/g, '/');
    }
    const abs = s.startsWith('/');
    s = s.replace(/\/{2,}/g, '/');
    if (abs && !s.startsWith('/')) {
      s = '/' + s;
    }
    return s;
  }

  // Windows-shaped path: unify separators to '\'.
  s = s.replace(/\//g, '\\');

  const isUnc = /^\\{2,}[^\\]/.test(s);
  if (isUnc) {
    // \\server\share\path — keep exactly two leading backslashes, collapse rest.
    const body = s.replace(/^\\+/, '').replace(/\\{2,}/g, '\\');
    return '\\\\' + body;
  }

  // Drive letter: c:\, c:, c:foo, c:\\foo\\bar
  const driveMatch = /^([a-zA-Z]):\\?(.*)$/.exec(s);
  if (driveMatch) {
    const letter = driveMatch[1].toUpperCase();
    let rest = (driveMatch[2] || '').replace(/\\{2,}/g, '\\');
    rest = rest.replace(/^\\+/, '');
    return rest ? (letter + ':\\' + rest) : (letter + ':\\');
  }

  // Relative Windows path with backslashes.
  return s.replace(/\\{2,}/g, '\\');
}

/**
 * Pick path API: prefer an injected module (for tests), else platform default.
 * @param {import('path')} [pathMod]
 * @returns {import('path').PlatformPath}
 */
function pathApi(pathMod) {
  if (pathMod) {
    return pathMod;
  }
  const path = require('path');
  return process.platform === 'win32' ? path.win32 : path;
}

/**
 * Resolve a path against baseDir (or cwd), after normalizeUserPath.
 *
 * @param {string} input
 * @param {string} [baseDir]
 * @param {import('path')} [pathMod]
 * @returns {string}
 */
function resolveUserPath(input, baseDir, pathMod) {
  const api = pathApi(pathMod);
  const normalized = normalizeUserPath(input);
  if (!normalized) {
    return api.normalize(baseDir || process.cwd());
  }

  if (api.isAbsolute(normalized) || /^[a-zA-Z]:\\/.test(normalized) ||
      normalized.startsWith('\\\\')) {
    return api.normalize(normalized);
  }

  const base = baseDir || process.cwd();
  return api.normalize(api.join(base, normalized));
}

/**
 * Resolve a CLI path trying each base directory in order.
 * Returns the first candidate that exists; if none exist, returns the first
 * resolved path (same behavior as run / --env-file fallback today).
 *
 * Typical use: try cwd first, then the .mmt file's directory.
 *
 * @param {string} input
 * @param {string|string[]} baseDirs
 * @param {import('path')} [pathMod]
 * @param {(p: string) => boolean} [existsFn]
 * @returns {string}
 */
function resolveUserPathPreferExisting(input, baseDirs, pathMod, existsFn) {
  const exists = typeof existsFn === 'function' ?
      existsFn :
      ((p) => {
        try {
          return require('fs').existsSync(p);
        } catch {
          return false;
        }
      });
  const bases = (Array.isArray(baseDirs) ? baseDirs : [baseDirs])
                    .filter((b) => typeof b === 'string' && b.length > 0);
  if (bases.length === 0) {
    bases.push(process.cwd());
  }

  let first = '';
  for (const base of bases) {
    const resolved = resolveUserPath(input, base, pathMod);
    if (!first) {
      first = resolved;
    }
    if (exists(resolved)) {
      return resolved;
    }
  }
  return first;
}

module.exports = {
  normalizeUserPath,
  resolveUserPath,
  resolveUserPathPreferExisting,
};
