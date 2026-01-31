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

  test('windows: handles drive base directory', () => {
    const base = 'C:\\Users\\Mehrdad\\projects\\mmt';
    const full = 'C:\\Users\\Mehrdad\\projects\\mmt\\api1.mmt';
    expect(computeRelative(base, full)).toBe('api1.mmt');
  });

  test('windows: handles base pointing to a file', () => {
    const base = 'C:\\Users\\Mehrdad\\projects\\mmt\\suite.mmt';
    const full = 'C:\\Users\\Mehrdad\\projects\\mmt\\suite1.mmt';
    expect(computeRelative(base, full)).toBe('suite1.mmt');
  });

  test('windows: handles different drives by returning full', () => {
    const base = 'C:\\Users\\Mehrdad\\projects\\mmt';
    const full = 'D:\\data\\file.mmt';
    expect(computeRelative(base, full)).toBe('D:/data/file.mmt');
  });

  test('windows: base from file URI does not produce ../../..../c:/ style', () => {
    const base = 'file:///C:/Users/x/docs/suite.mmt';
    const full = 'C:/Users/x/docs/smoke/test.mmt';
    expect(computeRelative(base, full)).toBe('smoke/test.mmt');
  });

  test('windows: full from file URI does not produce ../../..../c:/ style', () => {
    const base = 'C:/Users/x/docs/suite.mmt';
    const full = 'file:///C:/Users/x/docs/smoke/test.mmt';
    expect(computeRelative(base, full)).toBe('smoke/test.mmt');
  });

  test('windows: handles sibling folders on same drive', () => {
    const base = 'C:\\Users\\Mehrdad\\projects\\foo\\projectA';
    const full = 'C:\\Users\\Mehrdad\\projects\\foo\\projectB\\file.mmt';
    expect(computeRelative(base, full)).toBe('../projectB/file.mmt');
  });

  test('windows: mixed slashes still computes correct relative', () => {
    const base = 'C:\\Users\\x\\docs\\suite.mmt';
    const full = 'C:\\Users\\x\\docs\\smoke\\test.mmt';
    expect(computeRelative(base, full)).toBe('smoke/test.mmt');
  });
});

describe('path helpers', () => {
  test('fileUriToPath decodes file URIs', () => {
    expect(fileUriToPath('file:///Users/foo/bar.mmt'))
        .toBe('/Users/foo/bar.mmt');
    expect(fileUriToPath('/already/path')).toBe('/already/path');
  });

  test('fileUriToPath decodes Windows file URIs', () => {
    expect(fileUriToPath('file:///C:/Users/foo/bar.mmt'))
        .toBe('/C:/Users/foo/bar.mmt');
    expect(fileUriToPath('file:///c:/Users/foo/bar.mmt'))
        .toBe('/c:/Users/foo/bar.mmt');
  });

  test('resolveDotSegments collapses dot segments', () => {
    expect(resolveDotSegments('/a/./b/../c')).toBe('/a/c');
    expect(resolveDotSegments('x/./y/../z')).toBe('x/z');
  });

  test('resolveDotSegments supports Windows drive prefixes', () => {
    expect(resolveDotSegments('C:/a/./b/../c')).toBe('C:/a/c');
    expect(resolveDotSegments('C:\\a\\.\\b\\..\\c')).toBe('C:/a/c');
  });

  test('resolveRequestedAgainst handles relative paths', () => {
    const base = '/root/tests/main.mmt';
    expect(resolveRequestedAgainst(base, './foo.mmt'))
        .toBe('/root/tests/foo.mmt');
    expect(resolveRequestedAgainst(base, '../common/bar.mmt'))
        .toBe('/root/common/bar.mmt');
  });

  test('resolveRequestedAgainst handles Windows base paths', () => {
    const base = 'C:\\root\\tests\\main.mmt';
    expect(resolveRequestedAgainst(base, '.\\foo.mmt'))
        .toBe('C:/root/tests/foo.mmt');
    expect(resolveRequestedAgainst(base, '..\\common\\bar.mmt'))
        .toBe('C:/root/common/bar.mmt');
  });

  test('resolveRequestedAgainst preserves absolute Windows requested', () => {
    const base = 'C:\\root\\tests\\main.mmt';
    expect(resolveRequestedAgainst(base, 'C:\\root\\tests\\child.mmt'))
        .toBe('C:/root/tests/child.mmt');
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

  test('resolveRequestedAgainst normalizes Windows file URI requested', () => {
    const base = 'C:\\root\\tests\\main.mmt';
    expect(resolveRequestedAgainst(base, 'file:///C:/root/tests/./child.mmt'))
        .toBe('/C:/root/tests/child.mmt');
  });

  test('resolveRequestedAgainst handles +/ project root imports', () => {
    const base = '/project/tests/deep/main.mmt';
    const projectRoot = '/project';
    expect(resolveRequestedAgainst(base, '+/apis/user.mmt', projectRoot))
        .toBe('/project/apis/user.mmt');
    expect(resolveRequestedAgainst(base, '+/data/users.csv', projectRoot))
        .toBe('/project/data/users.csv');
  });

  test('resolveRequestedAgainst throws for +/ without projectRoot', () => {
    const base = '/project/tests/main.mmt';
    expect(() => resolveRequestedAgainst(base, '+/apis/user.mmt'))
      .toThrow('multimeter.mmt not found');
  });

  test('resolveRequestedAgainst handles +/ with Windows paths', () => {
    const base = 'C:\\project\\tests\\main.mmt';
    const projectRoot = 'C:/project';
    expect(resolveRequestedAgainst(base, '+/apis/user.mmt', projectRoot))
        .toBe('C:/project/apis/user.mmt');
  });
});
