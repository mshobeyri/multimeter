import {importsToJsfunc} from './JSerImports';
import {setFileLoader} from './JSerFileLoader';
import {
  bindCachedImportFn,
  CACHED_IMPORT_FN,
  getRunFileCache,
  resetRunFileCache,
} from './runFileCache';
import {createTestFileLoaderMock} from './testFileLoaderMock';

describe('runFileCache', () => {
  beforeEach(() => {
    resetRunFileCache();
  });

  afterEach(() => {
    resetRunFileCache();
  });

  it('reuses file text until beginRun sees a stamp change', async () => {
    const cache = getRunFileCache();
    const stamps = new Map<string, string>([['/a.mmt', '1']]);
    let reads = 0;
    const loader = async () => {
      reads += 1;
      return 'type: api';
    };

    await cache.beginRun((p) => stamps.get(p) || 'missing');
    const wrapped = cache.wrap(loader);
    expect(await wrapped('/a.mmt')).toBe('type: api');
    expect(await wrapped('/a.mmt')).toBe('type: api');
    expect(reads).toBe(1);

    await cache.beginRun((p) => stamps.get(p) || 'missing');
    expect(await wrapped('/a.mmt')).toBe('type: api');
    expect(reads).toBe(1);

    stamps.set('/a.mmt', '2');
    await cache.beginRun((p) => stamps.get(p) || 'missing');
    expect(await wrapped('/a.mmt')).toBe('type: api');
    expect(reads).toBe(2);
  });

  it('resets the whole cache when any cached file changes', async () => {
    const cache = getRunFileCache();
    const stamps = new Map<string, string>([['/a.mmt', '1'], ['/b.mmt', '1']]);
    let reads = 0;
    const loader = async (p: string) => {
      reads += 1;
      return p;
    };

    await cache.beginRun((p) => stamps.get(p) || 'missing');
    const wrapped = cache.wrap(loader);
    await wrapped('/a.mmt');
    await wrapped('/b.mmt');
    expect(reads).toBe(2);

    stamps.set('/b.mmt', 'changed');
    await cache.beginRun((p) => stamps.get(p) || 'missing');
    await wrapped('/a.mmt');
    await wrapped('/b.mmt');
    expect(reads).toBe(4);
  });

  it('clears the cache at beginRun when no stamp function is provided', async () => {
    const cache = getRunFileCache();
    let reads = 0;
    const loader = async () => {
      reads += 1;
      return 'once';
    };
    const wrapped = cache.wrap(loader);
    await wrapped('/x.mmt');
    await cache.beginRun();
    await wrapped('/x.mmt');
    expect(reads).toBe(2);
  });

  it('rebinds cached import function names', () => {
    const js = `const ${CACHED_IMPORT_FN} = async ({ } = {}) => { return {}; };`;
    expect(bindCachedImportFn(js, 'echo_get_'))
        .toBe('const echo_get_ = async ({ } = {}) => { return {}; };');
  });

  it('reuses generated API JS across imports of the same file', async () => {
    const mock = createTestFileLoaderMock({
      '/api/ping.mmt': [
        'type: api',
        'title: Ping',
        'url: https://example.com/ping',
        'method: get',
      ].join('\n'),
    });
    setFileLoader(mock.fileLoader);

    const first = await importsToJsfunc({ping: '/api/ping.mmt'}, undefined, '/test.mmt');
    const cached = getRunFileCache().getImportJs(
        '/api/ping.mmt', mock.get('/api/ping.mmt') || '');
    expect(cached?.js).toContain(`const ${CACHED_IMPORT_FN} =`);
    expect(first).toContain('const ping_ =');
    expect(first).not.toContain(CACHED_IMPORT_FN);

    const second = await importsToJsfunc({ping: '/api/ping.mmt'}, undefined, '/test.mmt');
    expect(second).toBe(first);
  });
});
