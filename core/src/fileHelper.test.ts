import {computeRelative} from './fileHelper';

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
