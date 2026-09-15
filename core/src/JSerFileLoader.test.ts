import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {readFile, setFileLoader} from './JSerFileLoader';
import {createTestFileLoaderMock} from './testFileLoaderMock';

describe('JSerFileLoader', () => {
  afterEach(() => {
    setFileLoader(async (p: string) => {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {
        return '';
      }
    });
  });

  test('default readFile returns empty when the file cannot be read', async () => {
    expect(await readFile(path.join(os.tmpdir(), 'mmt-missing-nope.txt'))).toBe('');
  });

  test('setFileLoader replaces the default', async () => {
    setFileLoader(async () => 'injected');
    expect(await readFile('any')).toBe('injected');
  });

  test('createTestFileLoaderMock stores paths and empty misses', async () => {
    const mock = createTestFileLoaderMock();
    expect(await mock.fileLoader('gone')).toBe('');
    mock.set('a.mmt', 'type: test');
    expect(mock.get('a.mmt')).toBe('type: test');
    expect(mock.get('gone')).toBeUndefined();
    expect(mock.paths()).toEqual(['a.mmt']);
    expect(await mock.fileLoader('a.mmt')).toBe('type: test');
  });
});
