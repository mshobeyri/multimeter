'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeUserPath,
  resolveUserPath,
  resolveUserPathPreferExisting,
  writeTextFile,
} = require('./pathNormalize.cjs');

describe('pathNormalize (Windows-shaped)', () => {
  const win = path.win32;

  it('normalizes drive letters and separators', () => {
    expect(normalizeUserPath('c:\\foo\\bar')).toBe('C:\\foo\\bar');
    expect(normalizeUserPath('c:/foo/bar')).toBe('C:\\foo\\bar');
    expect(normalizeUserPath('C://foo//bar')).toBe('C:\\foo\\bar');
    expect(normalizeUserPath('c:\\\\foo\\\\bar')).toBe('C:\\foo\\bar');
    expect(normalizeUserPath('c:foo')).toBe('C:\\foo');
    expect(normalizeUserPath('d:\\')).toBe('D:\\');
  });

  it('normalizes relative and UNC paths', () => {
    expect(normalizeUserPath('foo\\\\bar//baz')).toBe('foo\\bar\\baz');
    expect(normalizeUserPath('\\\\server\\share\\a')).toBe('\\\\server\\share\\a');
    expect(normalizeUserPath('//server/share/a')).toBe('\\\\server\\share\\a');
    expect(normalizeUserPath('"C:\\temp\\a.mmt"')).toBe('C:\\temp\\a.mmt');
  });

  it('resolves relative and absolute Windows paths', () => {
    const base = 'C:\\projects\\demo';
    expect(resolveUserPath('examples\\a.mmt', base, win))
        .toBe('C:\\projects\\demo\\examples\\a.mmt');
    expect(resolveUserPath('c:/examples/a.mmt', base, win))
        .toBe('C:\\examples\\a.mmt');
    expect(resolveUserPath('C:\\\\examples\\\\a.mmt', base, win))
        .toBe('C:\\examples\\a.mmt');
  });

  it('resolves parent segments with / and \\ the same way', () => {
    const cwd = 'C:\\workspace\\proj\\ci\\job';
    expect(resolveUserPath('../../xxx/yyy.mmt', cwd, win))
        .toBe('C:\\workspace\\proj\\xxx\\yyy.mmt');
    expect(resolveUserPath('..\\..\\xxx\\yyy.mmt', cwd, win))
        .toBe('C:\\workspace\\proj\\xxx\\yyy.mmt');
    expect(resolveUserPath('../../env/multimeter.mmt', cwd, win))
        .toBe('C:\\workspace\\proj\\env\\multimeter.mmt');
    expect(resolveUserPath('..\\..\\env\\multimeter.mmt', cwd, win))
        .toBe('C:\\workspace\\proj\\env\\multimeter.mmt');
    expect(resolveUserPath('../sibling.mmt', 'C:\\a\\b\\c', win))
        .toBe('C:\\a\\b\\sibling.mmt');
    expect(resolveUserPath('.\\foo.mmt', 'C:\\a\\b', win)).toBe('C:\\a\\b\\foo.mmt');
  });

  it('prefers cwd for --env-file, then falls back to the file directory', () => {
    const cwd = 'C:\\workspace\\proj\\ci\\job';
    const fileDir = 'C:\\workspace\\proj\\xxx';
    const existing = new Set([
      'C:\\workspace\\proj\\multimeter.mmt',
    ]);
    const exists = (p: string) => existing.has(p);

    // ../../multimeter.mmt from cwd → proj\multimeter.mmt (exists)
    expect(resolveUserPathPreferExisting(
               '../../multimeter.mmt', [cwd, fileDir], win, exists))
        .toBe('C:\\workspace\\proj\\multimeter.mmt');

    // Same with backslashes
    expect(resolveUserPathPreferExisting(
               '..\\..\\multimeter.mmt', [cwd, fileDir], win, exists))
        .toBe('C:\\workspace\\proj\\multimeter.mmt');

    // Only exists relative to the .mmt file directory
    const onlyBesideFile = new Set([
      'C:\\workspace\\multimeter.mmt',
    ]);
    expect(resolveUserPathPreferExisting(
               '../../multimeter.mmt', [cwd, fileDir], win,
               (p: string) => onlyBesideFile.has(p)))
        .toBe('C:\\workspace\\multimeter.mmt');

    // Missing everywhere → still returns the cwd-based candidate
    expect(resolveUserPathPreferExisting(
               '../../missing.mmt', [cwd, fileDir], win, () => false))
        .toBe('C:\\workspace\\proj\\missing.mmt');
  });
});

describe('pathNormalize FS layout (../../ file + env)', () => {
  let root: string;
  let cwd: string;
  let testFile: string;
  let envFile: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-path-'));
    // root/
    //   multimeter.mmt
    //   xxx/yyy.mmt
    //   ci/job/          <- pretend cwd
    fs.mkdirSync(path.join(root, 'xxx'), {recursive: true});
    fs.mkdirSync(path.join(root, 'ci', 'job'), {recursive: true});
    envFile = path.join(root, 'multimeter.mmt');
    testFile = path.join(root, 'xxx', 'yyy.mmt');
    cwd = path.join(root, 'ci', 'job');
    fs.writeFileSync(envFile, 'type: env\nvariables:\n  api_url: https://test.mmt.dev\n');
    fs.writeFileSync(testFile, 'type: api\nurl: e:api_url\nmethod: get\n');
  });

  afterEach(() => {
    fs.rmSync(root, {recursive: true, force: true});
  });

  it('resolves ../../xxx/yyy.mmt and ../../multimeter.mmt from nested cwd', () => {
    const resolvedFile = resolveUserPath('../../xxx/yyy.mmt', cwd);
    const resolvedEnv = resolveUserPathPreferExisting(
        '../../multimeter.mmt', [cwd, path.dirname(resolvedFile)]);

    expect(resolvedFile).toBe(testFile);
    expect(resolvedEnv).toBe(envFile);
    expect(fs.existsSync(resolvedFile)).toBe(true);
    expect(fs.existsSync(resolvedEnv)).toBe(true);
    expect(fs.readFileSync(resolvedEnv, 'utf8')).toContain('api_url');
  });

  it('resolves Windows-separator relatives against a Windows-shaped base', () => {
    // Simulate the same tree with win32 join semantics (path strings only).
    const winRoot = 'C:\\repo';
    const winCwd = 'C:\\repo\\ci\\job';
    const winFile = resolveUserPath('..\\..\\xxx\\yyy.mmt', winCwd, path.win32);
    const winEnv = resolveUserPath('..\\..\\multimeter.mmt', winCwd, path.win32);
    expect(winFile).toBe('C:\\repo\\xxx\\yyy.mmt');
    expect(winEnv).toBe('C:\\repo\\multimeter.mmt');

    // Mixed separators from a Windows cwd
    expect(resolveUserPath('../../xxx/yyy.mmt', winCwd, path.win32))
        .toBe('C:\\repo\\xxx\\yyy.mmt');
    expect(winRoot).toBe('C:\\repo');
  });

  it('falls back to file-dir when env is not reachable from cwd', () => {
    // Put env beside the test file only: root/xxx/multimeter.mmt
    const localEnv = path.join(root, 'xxx', 'multimeter.mmt');
    fs.writeFileSync(localEnv, 'type: env\nvariables:\n  x: 1\n');
    fs.unlinkSync(envFile);

    const resolvedFile = resolveUserPath('../../xxx/yyy.mmt', cwd);
    const resolvedEnv = resolveUserPathPreferExisting(
        'multimeter.mmt', [cwd, path.dirname(resolvedFile)]);

    expect(resolvedFile).toBe(testFile);
    expect(resolvedEnv).toBe(localEnv);
  });

  it('creates missing parent directories when writing a report file', () => {
    const reportPath = path.join(root, 'results', 'nested', 'junit.xml');
    const written = writeTextFile(reportPath, '<testsuites/>');
    expect(written).toBe(reportPath);
    expect(fs.readFileSync(reportPath, 'utf8')).toBe('<testsuites/>');
  });
});
