import {
  computeRelative,
  fileUriToPath,
  resolveDotSegments,
  resolveRequestedAgainst,
} from './fileHelper';

describe('computeRelative', () => {
  test('returns empty for missing full', () => {
    expect(computeRelative('/a/b', undefined)).toBe('');
  });

  test('returns full when base is undefined', () => {
    expect(computeRelative(undefined, '/a/b/file.txt')).toBe('/a/b/file.txt');
  });

  test('handles file:// base pointing to a file', () => {
    const base = 'file:///Users/mehrdad/projects/multimetertest/suite.mmt';
    const full = '/Users/mehrdad/projects/multimetertest/suite1.mmt';
    expect(computeRelative(base, full)).toBe('suite1.mmt');
  });

  test('handles base directory', () => {
    const base = '/Users/mehrdad/projects/mmt';
    const full = '/Users/mehrdad/projects/mmt/api1.mmt';
    expect(computeRelative(base, full)).toBe('api1.mmt');
  });

  test('falls back to removing common prefix for siblings', () => {
    const base = '/Users/mehrdad/projects/foo/projectA';
    const full = '/Users/mehrdad/projects/foo/projectB/file.mmt';
    expect(computeRelative(base, full)).toBe('../projectB/file.mmt');
  });
  
  test('falls back to removing common prefix for siblings with /', () => {
    const base = '/Users/mehrdad/projects/foo/projectA/';
    const full = '/Users/mehrdad/projects/foo/projectB/file.mmt';
    expect(computeRelative(base, full)).toBe('../projectB/file.mmt');
  });

  test('falls back to removing common prefix for siblings file', () => {
    const base = '/Users/mehrdad/projects/foo/projectA/file.mmt';
    const full = '/Users/mehrdad/projects/foo/projectB/file.mmt';
    expect(computeRelative(base, full)).toBe('../projectB/file.mmt');
  });

  test('returns absolute when no common prefix', () => {
    const base = '/one/two';
    const full = '/other/path/file.mmt';
    expect(computeRelative(base, full)).toBe('../../other/path/file.mmt');
  });
});

describe('path helpers', () => {
  test('fileUriToPath decodes file URIs', () => {
    expect(fileUriToPath('file:///Users/foo/bar.mmt'))
        .toBe('/Users/foo/bar.mmt');
    expect(fileUriToPath('/already/path')).toBe('/already/path');
  });

  test('resolveDotSegments collapses dot segments', () => {
    expect(resolveDotSegments('/a/./b/../c')).toBe('/a/c');
    expect(resolveDotSegments('x/./y/../z')).toBe('x/z');
  });

  test('resolveRequestedAgainst handles relative paths', () => {
    const base = '/root/tests/main.mmt';
    expect(resolveRequestedAgainst(base, './foo.mmt'))
        .toBe('/root/tests/foo.mmt');
    expect(resolveRequestedAgainst(base, '../common/bar.mmt'))
        .toBe('/root/common/bar.mmt');
  });

  test('resolveRequestedAgainst handles dot segments in request itself', () => {
    const base = '/root/tests/main.mmt';
    expect(resolveRequestedAgainst(base, 'test/../test/users.csv'))
        .toBe('/root/tests/test/users.csv');
  });

  test('resolveRequestedAgainst returns normalized absolute for file URIs', () => {
    const base = '/root/tests/main.mmt';
    expect(resolveRequestedAgainst(base, 'file:///root/tests/./child.mmt'))
        .toBe('/root/tests/child.mmt');
  });
});
