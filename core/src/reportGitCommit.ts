function extractGitHex(raw?: string | null): string | undefined {
  const s = String(raw ?? '').trim();
  if (!s) {
    return undefined;
  }
  const hex = s.replace(/^[^0-9a-fA-F]+/, '');
  if (!/^[0-9a-fA-F]{7,40}$/.test(hex)) {
    return undefined;
  }
  return hex.toLowerCase();
}

/**
 * Normalize a raw git SHA (or short SHA) to the first 8 hex chars.
 * Returns undefined when the value is missing or not a plausible commit id.
 */
export function normalizeReportGitCommit(raw?: string | null): string | undefined {
  const hex = extractGitHex(raw);
  return hex ? hex.slice(0, 8) : undefined;
}

/**
 * Normalize a full git SHA (40 hex chars preferred; accepts 7–40).
 * Returns undefined when the value is missing or not a plausible commit id.
 */
export function normalizeReportGitCommitHash(raw?: string | null): string | undefined {
  return extractGitHex(raw);
}

/**
 * Normalize `git describe` output for current tokens / reports.
 */
export function normalizeReportGitDescribe(raw?: string | null): string | undefined {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 255 || /[\s\x00-\x1f\x7f]/.test(s)) {
    return undefined;
  }
  return s;
}

/**
 * Normalize a git branch name for report overview storage.
 * Returns undefined when missing, detached (`HEAD`), or not a single-line name.
 */
export function normalizeReportGitBranch(raw?: string | null): string | undefined {
  const s = String(raw ?? '').trim();
  if (!s || s === 'HEAD') {
    return undefined;
  }
  // Single printable token — no whitespace / control chars; keep typical branch shapes.
  if (s.length > 255 || /[\s\x00-\x1f\x7f]/.test(s)) {
    return undefined;
  }
  return s;
}

function isValidGitRefName(s: string): boolean {
  return s.length > 0 && s.length <= 255 && !/[\s\x00-\x1f\x7f]/.test(s);
}

/**
 * Normalize tag name(s) for report overview storage.
 * Accepts a single tag or newline/comma-separated list (e.g. `git tag --points-at HEAD`).
 * Returns a comma-separated string, or undefined when none are valid.
 */
export function normalizeReportGitTag(raw?: string | null): string | undefined {
  const parts = String(raw ?? '')
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const tags: string[] = [];
  for (const part of parts) {
    if (isValidGitRefName(part)) {
      tags.push(part);
    }
  }
  if (tags.length === 0) {
    return undefined;
  }
  return tags.join(', ');
}
