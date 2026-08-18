import {
  formatRelativeTime,
  parseTempFileMeta,
  sanitizeTempFileName,
  sortTempFiles,
  uniqueTempFileName,
} from './tempFileMeta';
import {buildTempMmtUriParts, parseTempMmtPath, parseTempMmtUriParts} from './tempMmtUri';

describe('parseTempFileMeta', () => {
  it('reads type, title, and type icon', () => {
    const meta = parseTempFileMeta(
        'type: api\ntitle: Echo login\nurl: https://test.mmt.dev\n');
    expect(meta.type).toBe('api');
    expect(meta.title).toBe('Echo login');
    expect(meta.icon).toBe('symbol-method');
    expect(meta.color).toBe('#1f6feb');
  });

  it('falls back for empty gallery files', () => {
    const meta = parseTempFileMeta('', 'untitled');
    expect(meta.type).toBeNull();
    expect(meta.title).toBe('untitled');
    expect(meta.icon).toBe('file');
  });

  it('strips quotes from title', () => {
    expect(parseTempFileMeta('type: test\ntitle: "My test"\n').title)
        .toBe('My test');
  });
});

describe('temp file names', () => {
  it('adds .mmt when missing', () => {
    expect(sanitizeTempFileName('post')).toBe('post.mmt');
  });

  it('increments duplicate names', () => {
    expect(uniqueTempFileName('untitled.mmt', ['untitled.mmt', 'untitled-2.mmt']))
        .toBe('untitled-3.mmt');
  });
});

describe('sortTempFiles', () => {
  it('keeps pinned files first, then newest created, with archived last', () => {
    const sorted = sortTempFiles([
      {pinned: false, createdAt: 30, archived: false},
      {pinned: true, createdAt: 10, archived: false},
      {pinned: false, createdAt: 40, archived: true},
      {pinned: false, createdAt: 50, archived: false},
      {pinned: true, createdAt: 20, archived: false},
    ]);
    expect(sorted.map(item => item.createdAt)).toEqual([20, 10, 50, 30, 40]);
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-08-18T18:00:00Z');

  it('uses Copilot-style buckets', () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 120_000, now)).toBe('2 min ago');
    expect(formatRelativeTime(now - 3_600_000, now)).toBe('1 hr ago');
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago');
    expect(formatRelativeTime(now - 45 * 86_400_000, now)).toBe('1 mo ago');
  });
});

describe('temp mmt URI paths', () => {
  it('builds a short tab path with the id as authority', () => {
    expect(buildTempMmtUriParts('abc', 'untitled.mmt')).toEqual({
      authority: 'abc',
      path: '/untitled.mmt',
    });
  });

  it('parses the short form', () => {
    expect(parseTempMmtUriParts('abc', '/untitled.mmt'))
        .toEqual({id: 'abc', fileName: 'untitled.mmt'});
  });

  it('still parses legacy workspace-scoped paths', () => {
    expect(parseTempMmtUriParts(
               '', '/Users/me/proj/.mmt-temp/abc/untitled.mmt'))
        .toEqual({id: 'abc', fileName: 'untitled.mmt'});
  });

  it('parses the legacy no-workspace form', () => {
    expect(parseTempMmtPath('/abc/post.mmt'))
        .toEqual({id: 'abc', fileName: 'post.mmt'});
  });
});
