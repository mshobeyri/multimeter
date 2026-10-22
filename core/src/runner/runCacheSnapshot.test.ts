import {
  createEnvStore,
  listLiveEnvCacheEntries,
  registerActiveEnvStore,
  unregisterActiveEnvStore,
} from '../env/envStore';
import {clearTestCallCache_, setTestCallCache_} from './testHelper';
import {listRunCacheEntries} from './runCacheSnapshot';

describe('listRunCacheEntries', () => {
  beforeEach(() => {
    clearTestCallCache_();
  });

  it('combines test-call and live-env snapshots', async () => {
    setTestCallCache_(
        'T', {a: 1}, {ok: true}, Date.now() + 60_000, '/project/t.mmt');

    const store = createEnvStore({session: './create.mmt'});
    store.runEnvFile = async () => ({
      outputs: {session: 'abc'},
      outputKeys: ['session'],
      cache: '1h',
    });
    registerActiveEnvStore(store);
    try {
      await (store.values.session as () => Promise<any>)();
      const entries = listRunCacheEntries();
      const testCall = entries.find(e => e.kind === 'test-call');
      expect(testCall).toMatchObject({
        kind: 'test-call',
        title: 'T',
        filePath: '/project/t.mmt',
      });
      expect(entries.some(e => e.kind === 'live-env')).toBe(true);
      expect(listLiveEnvCacheEntries()[0]).toMatchObject({
        kind: 'live-env',
        name: 'session',
        filePath: './create.mmt',
        value: 'abc',
      });
    } finally {
      unregisterActiveEnvStore(store);
    }
  });
});
