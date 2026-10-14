/**
 * Injected git metadata for `c:git_*` / short-alias current tokens.
 * Hosts (CLI, extension) resolve via `git` and call {@link setGitCurrentSnapshot}
 * before runs. Core stays free of `child_process` / `fs`.
 */
export type GitCurrentSnapshot = {
  /** Current branch name (omitted when detached / unavailable). */
  branch?: string;
  /** First 8 hex chars of HEAD. */
  commit?: string;
  /** Full HEAD SHA. */
  commitHash?: string;
  /** Tag(s) pointing at HEAD (comma-separated if several). */
  tag?: string;
  /** `git describe --tags --always` output. */
  describe?: string;
  /** True when the worktree has uncommitted changes. */
  dirty?: boolean;
};

let gitSnapshot: GitCurrentSnapshot | undefined;

/** Replace the process-wide git snapshot used by current-token generators. */
export function setGitCurrentSnapshot(snapshot: GitCurrentSnapshot | undefined): void {
  gitSnapshot = snapshot;
}

/** Clear injected git metadata (tests). */
export function clearGitCurrentSnapshot(): void {
  gitSnapshot = undefined;
}

/** Read the current snapshot (tests / hosts). */
export function getGitCurrentSnapshot(): GitCurrentSnapshot | undefined {
  return gitSnapshot;
}

export function currentGitBranch(): string {
  return gitSnapshot?.branch ?? '';
}

export function currentGitCommit(): string {
  return gitSnapshot?.commit ?? '';
}

export function currentGitCommitHash(): string {
  return gitSnapshot?.commitHash ?? '';
}

export function currentGitTag(): string {
  return gitSnapshot?.tag ?? '';
}

export function currentGitDescribe(): string {
  return gitSnapshot?.describe ?? '';
}

export function currentGitDirty(): boolean {
  return gitSnapshot?.dirty === true;
}

/** Sanitize one path segment (no empties, `.`, `..`, or control chars). */
export function sanitizeReportPathSegment(raw: string): string {
  const s = String(raw ?? '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/[\x00-\x1f\x7f]/g, '');
  if (!s || s === '.' || s === '..') {
    return '';
  }
  // Disallow path separators inside a single segment.
  if (s.includes('/')) {
    return s.split('/').map(sanitizeReportPathSegment).filter(Boolean).join('/');
  }
  return s;
}

/**
 * Preferred report tree folder from git snapshot:
 * - exact tag → `tags/<tag>` (first tag if several)
 * - branch → `branch/<branch>/<commit>`
 * - detached → `detached/<commit>`
 * - no git → `local`
 */
export function currentReportFolder(): string {
  const tagRaw = String(gitSnapshot?.tag ?? '').trim();
  if (tagRaw) {
    const firstTag = tagRaw.split(',')[0]?.trim() || '';
    const tagSeg = sanitizeReportPathSegment(firstTag);
    if (tagSeg) {
      return `tags/${tagSeg}`;
    }
  }

  const commit = sanitizeReportPathSegment(String(gitSnapshot?.commit ?? '').trim());
  const branchRaw = String(gitSnapshot?.branch ?? '').trim();
  if (branchRaw && commit) {
    const branchSeg = sanitizeReportPathSegment(branchRaw);
    if (branchSeg) {
      return `branch/${branchSeg}/${commit}`;
    }
  }
  if (commit) {
    return `detached/${commit}`;
  }
  return 'local';
}
