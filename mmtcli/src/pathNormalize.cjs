'use strict';

/**
 * Normalize user/FS paths for CLI + pkg file loading.
 *
 * Accepts Windows and POSIX-style inputs:
 *   - / and \ separators
 *   - // and \\ (collapsed, except UNC \\server\share)
 *   - drive letters: c:\foo, c:/foo, C:\\foo, c:foo
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
 * Resolve a path against baseDir (or cwd), after normalizeUserPath.
 *
 * @param {string} input
 * @param {string} [baseDir]
 * @param {import('path')} [pathMod]
 * @returns {string}
 */
function resolveUserPath(input, baseDir, pathMod) {
  const path = pathMod || require('path');
  const normalized = normalizeUserPath(input);
  if (!normalized) {
    return path.normalize(baseDir || process.cwd());
  }

  // path.win32 treats forward slashes as separators too, but we already
  // normalized Windows-shaped paths to backslashes.
  const absCheck = process.platform === 'win32' ? path.win32 : path;
  if (absCheck.isAbsolute(normalized) || /^[a-zA-Z]:\\/.test(normalized) ||
      normalized.startsWith('\\\\')) {
    return absCheck.normalize(normalized);
  }

  const base = baseDir || process.cwd();
  return absCheck.normalize(absCheck.join(base, normalized));
}

module.exports = {
  normalizeUserPath,
  resolveUserPath,
};
