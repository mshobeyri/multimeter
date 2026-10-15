/**
 * Injected git metadata for `c:git_*` / short-alias current tokens.
 * Hosts register a {@link GitCurrentSnapshotProvider}; core calls it on first
 * git-token access so resolution stays with other `c:` tokens (on demand).
 * Core stays free of `child_process` / `fs`.
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

/** Host-supplied resolver; called at most once until cleared. */
export type GitCurrentSnapshotProvider = () => GitCurrentSnapshot|undefined;

let gitSnapshot: GitCurrentSnapshot|undefined;
let gitSnapshotLoaded = false;
let gitSnapshotProvider: GitCurrentSnapshotProvider|undefined;

/**
 * True when `text` appears to reference a current-token that needs a host git
 * snapshot. Used only where a Node provider cannot run (e.g. webview open inject).
 */
export function textMayNeedGitCurrentSnapshot(text: string): boolean {
  if (!text || !text.includes('c:')) {
    return false;
  }
  return /(?:<<|\{\{)?c:(?:git_(?:branch|commit|commit_hash|tag|describe|dirty)|report_folder|branch|commit(?:_short|_hash|_hash_short)?|tag)\b/
      .test(text);
}

/**
 * Register a provider invoked on first git-token read.
 * Does not spawn git until a generator runs {@link ensureGitCurrentSnapshot}.
 */
export function setGitCurrentSnapshotProvider(
    provider: GitCurrentSnapshotProvider|undefined): void {
  gitSnapshotProvider = provider;
}

/** Clear the provider (hosts / tests). */
export function clearGitCurrentSnapshotProvider(): void {
  gitSnapshotProvider = undefined;
}

/**
 * Explicitly set the snapshot (tests, webview inject, workers with a prebuilt
 * snapshot). Marks loaded so the provider is not called afterward.
 */
export function setGitCurrentSnapshot(snapshot: GitCurrentSnapshot|undefined): void {
  gitSnapshot = snapshot;
  gitSnapshotLoaded = true;
}

/** Clear snapshot and allow the provider to run again on next access. */
export function clearGitCurrentSnapshot(): void {
  gitSnapshot = undefined;
  gitSnapshotLoaded = false;
}

/** Read the current snapshot without triggering the provider (tests / hosts). */
export function getGitCurrentSnapshot(): GitCurrentSnapshot|undefined {
  return gitSnapshot;
}

/**
 * Ensure a snapshot is available: use an explicit set value, or call the
 * provider once. Safe to call from every git `c:` generator.
 */
export function ensureGitCurrentSnapshot(): GitCurrentSnapshot|undefined {
  if (gitSnapshotLoaded) {
    return gitSnapshot;
  }
  gitSnapshotLoaded = true;
  if (gitSnapshotProvider) {
    try {
      gitSnapshot = gitSnapshotProvider() ?? undefined;
    } catch {
      gitSnapshot = undefined;
    }
  }
  return gitSnapshot;
}

export function currentGitBranch(): string {
  return ensureGitCurrentSnapshot()?.branch ?? '';
}

export function currentGitCommit(): string {
  return ensureGitCurrentSnapshot()?.commit ?? '';
}

export function currentGitCommitHash(): string {
  return ensureGitCurrentSnapshot()?.commitHash ?? '';
}

export function currentGitTag(): string {
  return ensureGitCurrentSnapshot()?.tag ?? '';
}

export function currentGitDescribe(): string {
  return ensureGitCurrentSnapshot()?.describe ?? '';
}

export function currentGitDirty(): boolean {
  return ensureGitCurrentSnapshot()?.dirty === true;
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
  const snap = ensureGitCurrentSnapshot();
  const tagRaw = String(snap?.tag ?? '').trim();
  if (tagRaw) {
    const firstTag = tagRaw.split(',')[0]?.trim() || '';
    const tagSeg = sanitizeReportPathSegment(firstTag);
    if (tagSeg) {
      return `tags/${tagSeg}`;
    }
  }

  const commit = sanitizeReportPathSegment(String(snap?.commit ?? '').trim());
  const branchRaw = String(snap?.branch ?? '').trim();
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
