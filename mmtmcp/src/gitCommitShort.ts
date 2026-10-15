import {execFileSync} from 'child_process';
import type {GitCurrentSnapshot} from 'mmt-core/Current';
import {
  clearGitCurrentSnapshot,
  setGitCurrentSnapshot,
  setGitCurrentSnapshotProvider,
} from 'mmt-core/Current';
import {
  normalizeReportGitBranch,
  normalizeReportGitCommit,
  normalizeReportGitCommitHash,
  normalizeReportGitDescribe,
  normalizeReportGitTag,
} from 'mmt-core/reportGitCommit';

function gitExec(cwd: string | undefined, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Best-effort short git commit (8 chars) for the given working directory.
 * Returns undefined when git is unavailable, the path is not a repo, or lookup fails.
 */
export function tryGitCommitShort(cwd?: string): string | undefined {
  return normalizeReportGitCommit(gitExec(cwd, ['rev-parse', 'HEAD']));
}

/**
 * Best-effort current branch name for the given working directory.
 * Returns undefined when git is unavailable, detached HEAD, or lookup fails.
 */
export function tryGitBranch(cwd?: string): string | undefined {
  return normalizeReportGitBranch(gitExec(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']));
}

/**
 * Best-effort tag(s) pointing at HEAD for the given working directory.
 * Returns undefined when git is unavailable, no tags point at HEAD, or lookup fails.
 * Multiple tags are joined with ", ".
 */
export function tryGitTag(cwd?: string): string | undefined {
  return normalizeReportGitTag(gitExec(cwd, ['tag', '--points-at', 'HEAD']));
}

/**
 * Resolve git metadata for reports and `c:git_*` current tokens.
 * Missing fields are omitted; never throws.
 */
export function resolveGitCurrentSnapshot(cwd?: string): GitCurrentSnapshot {
  const commitHash = normalizeReportGitCommitHash(gitExec(cwd, ['rev-parse', 'HEAD']));
  const commit = commitHash ? normalizeReportGitCommit(commitHash) : undefined;
  const branch = tryGitBranch(cwd);
  const tag = tryGitTag(cwd);
  const describe = normalizeReportGitDescribe(
      gitExec(cwd, ['describe', '--tags', '--always']));
  const porcelain = gitExec(cwd, ['status', '--porcelain']);
  const dirty = porcelain === undefined ? undefined : porcelain.length > 0;

  const snapshot: GitCurrentSnapshot = {};
  if (branch) {
    snapshot.branch = branch;
  }
  if (commit) {
    snapshot.commit = commit;
  }
  if (commitHash) {
    snapshot.commitHash = commitHash;
  }
  if (tag) {
    snapshot.tag = tag;
  }
  if (describe) {
    snapshot.describe = describe;
  }
  if (dirty !== undefined) {
    snapshot.dirty = dirty;
  }
  return snapshot;
}

/**
 * Eagerly resolve and inject (report export UI, tests that need a fixed snapshot).
 */
export function applyGitCurrentSnapshot(cwd?: string): GitCurrentSnapshot {
  const snapshot = resolveGitCurrentSnapshot(cwd);
  setGitCurrentSnapshot(snapshot);
  return snapshot;
}

/**
 * Install an on-demand provider so `c:git_*` resolution runs with other `c:`
 * tokens — git is spawned only when a git current-token is evaluated.
 */
export function installGitCurrentSnapshotProvider(cwd?: string): void {
  clearGitCurrentSnapshot();
  setGitCurrentSnapshotProvider(() => resolveGitCurrentSnapshot(cwd));
}
