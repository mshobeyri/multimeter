import {
  normalizeReportGitBranch,
  normalizeReportGitCommit,
  normalizeReportGitCommitHash,
  normalizeReportGitDescribe,
  normalizeReportGitTag,
} from '../reportGitCommit';

describe('normalizeReportGitCommit', () => {
  it('returns the first 8 hex chars', () => {
    expect(normalizeReportGitCommit('0a8c2017abcdef0123456789')).toBe('0a8c2017');
    expect(normalizeReportGitCommit('ABCDef01')).toBe('abcdef01');
  });

  it('returns undefined for empty or invalid values', () => {
    expect(normalizeReportGitCommit(undefined)).toBeUndefined();
    expect(normalizeReportGitCommit('')).toBeUndefined();
    expect(normalizeReportGitCommit('not-a-sha')).toBeUndefined();
    expect(normalizeReportGitCommit('xyz')).toBeUndefined();
  });
});

describe('normalizeReportGitBranch', () => {
  it('keeps typical branch names', () => {
    expect(normalizeReportGitBranch('main')).toBe('main');
    expect(normalizeReportGitBranch('feature/report-branch')).toBe('feature/report-branch');
    expect(normalizeReportGitBranch('  release/1.2  ')).toBe('release/1.2');
  });

  it('rejects missing, detached HEAD, and invalid names', () => {
    expect(normalizeReportGitBranch(undefined)).toBeUndefined();
    expect(normalizeReportGitBranch('')).toBeUndefined();
    expect(normalizeReportGitBranch('HEAD')).toBeUndefined();
    expect(normalizeReportGitBranch('bad name')).toBeUndefined();
  });
});

describe('normalizeReportGitCommitHash', () => {
  it('lowercases a full SHA', () => {
    expect(normalizeReportGitCommitHash('ABCDEF0123456789ABCDEF0123456789ABCDEF01'))
        .toBe('abcdef0123456789abcdef0123456789abcdef01');
  });

  it('rejects invalid values', () => {
    expect(normalizeReportGitCommitHash('')).toBeUndefined();
    expect(normalizeReportGitCommitHash('not-a-sha')).toBeUndefined();
  });
});

describe('normalizeReportGitDescribe', () => {
  it('keeps describe strings', () => {
    expect(normalizeReportGitDescribe('v1.0.0-12-gabcd1234')).toBe('v1.0.0-12-gabcd1234');
  });

  it('rejects blank or spaced values', () => {
    expect(normalizeReportGitDescribe('')).toBeUndefined();
    expect(normalizeReportGitDescribe('bad value')).toBeUndefined();
  });
});

describe('normalizeReportGitTag', () => {
  it('keeps a single tag', () => {
    expect(normalizeReportGitTag('v1.44.0')).toBe('v1.44.0');
    expect(normalizeReportGitTag('  v1.44.0-pre  ')).toBe('v1.44.0-pre');
  });

  it('joins multiple tags from newline or comma lists', () => {
    expect(normalizeReportGitTag('v1.0.0\nv1.0.0-docs')).toBe('v1.0.0, v1.0.0-docs');
    expect(normalizeReportGitTag('a, b')).toBe('a, b');
  });

  it('rejects missing or invalid tags', () => {
    expect(normalizeReportGitTag(undefined)).toBeUndefined();
    expect(normalizeReportGitTag('')).toBeUndefined();
    expect(normalizeReportGitTag('bad tag')).toBeUndefined();
  });
});
