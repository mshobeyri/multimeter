import {
  cloneEnvStore,
  createEnvStore,
  envFilePathOfGetter,
  firstEnvFileOutput,
  isEnvFilePathValue,
  isOsEnvRefValue,
  osEnvNameOfRef,
  osEnvRefOfGetter,
  plainEnvValuesForClone,
  readEnvStoreValue,
} from './envStore';

describe('envStore', () => {
  it('copies initial values so the source stays untouched', () => {
    const source = {a: 1, b: 'x'};
    const store = createEnvStore(source);
    store.values.a = 2;
    store.values.c = 3;
    expect(source).toEqual({a: 1, b: 'x'});
    expect(store.values).toEqual({a: 2, b: 'x', c: 3});
  });

  it('cloneEnvStore isolates VU mutations', () => {
    const parent = createEnvStore({token: 'shared'});
    const vu1 = cloneEnvStore(parent);
    const vu2 = cloneEnvStore(parent);
    vu1.values.token = 'vu1';
    expect(vu2.values.token).toBe('shared');
    expect(parent.values.token).toBe('shared');
  });

  it('isEnvFilePathValue requires ./ prefix and .mmt suffix', () => {
    expect(isEnvFilePathValue('./session.mmt')).toBe(true);
    expect(isEnvFilePathValue('./nested/x.mmt')).toBe(true);
    expect(isEnvFilePathValue('session.mmt')).toBe(false);
    expect(isEnvFilePathValue('/abs/x.mmt')).toBe(false);
    expect(isEnvFilePathValue('+/x.mmt')).toBe(false);
    expect(isEnvFilePathValue('./note.txt')).toBe(false);
  });

  it('isOsEnvRefValue requires whole-string $NAME', () => {
    expect(isOsEnvRefValue('$API_TOKEN')).toBe(true);
    expect(isOsEnvRefValue(' $HOST ')).toBe(true);
    expect(osEnvNameOfRef('$API_TOKEN')).toBe('API_TOKEN');
    expect(isOsEnvRefValue('API_TOKEN')).toBe(false);
    expect(isOsEnvRefValue('https://$HOST')).toBe(false);
    expect(isOsEnvRefValue('$1BAD')).toBe(false);
    expect(isOsEnvRefValue('${API_TOKEN}')).toBe(false);
  });

  it('converts $VAR to getters that read injected processEnv', async () => {
    const store = createEnvStore(
        {token: '$API_TOKEN', host: 'https://x'},
        {processEnv: {API_TOKEN: 'secret', EMPTY: ''}},
    );
    expect(typeof store.values.token).toBe('function');
    expect(osEnvRefOfGetter(store.values.token)).toBe('$API_TOKEN');
    expect(store.values.host).toBe('https://x');
    expect(await readEnvStoreValue(store, 'token')).toBe('secret');

    const missing = createEnvStore(
        {token: '$MISSING'}, {processEnv: {}});
    expect(await readEnvStoreValue(missing, 'token')).toBeUndefined();

    const empty = createEnvStore(
        {token: '$EMPTY'}, {processEnv: {EMPTY: ''}});
    expect(await readEnvStoreValue(empty, 'token')).toBeUndefined();

    // setenv-style overwrite stays a plain string.
    store.values.token = '$OTHER';
    expect(typeof store.values.token).toBe('string');
  });

  it('plainEnvValuesForClone restores $VAR from getters', () => {
    const store = createEnvStore(
        {token: '$API_TOKEN', n: 1}, {processEnv: {API_TOKEN: 'x'}});
    expect(plainEnvValuesForClone(store.values)).toEqual({
      token: '$API_TOKEN',
      n: 1,
    });
    const cloned = cloneEnvStore(store);
    expect(osEnvRefOfGetter(cloned.values.token)).toBe('$API_TOKEN');
    expect(cloned.processEnv).toEqual({API_TOKEN: 'x'});
  });

  it('converts ./…mmt to getters only at copy time', async () => {
    const source = {session: './create.mmt', host: 'https://x'};
    const store = createEnvStore(source);
    expect(typeof store.values.session).toBe('function');
    expect(envFilePathOfGetter(store.values.session)).toBe('./create.mmt');
    expect(store.values.host).toBe('https://x');
    expect(source.session).toBe('./create.mmt');

    store.runEnvFile = async () => ({
      outputs: {token: 'abc', unused: 'z'},
      outputKeys: ['token', 'unused'],
      cache: '1h',
    });
    expect(await store.values.session()).toBe('abc');
    // Cache hit — runner not called again.
    let calls = 0;
    store.runEnvFile = async () => {
      calls += 1;
      return {outputs: {token: 'new'}, outputKeys: ['token']};
    };
    expect(await store.values.session()).toBe('abc');
    expect(calls).toBe(0);

    // setenv-style overwrite stays a plain string, not a getter.
    store.values.session = './other.mmt';
    expect(typeof store.values.session).toBe('string');
    expect(store.values.session).toBe('./other.mmt');
  });

  it('firstEnvFileOutput uses declared YAML key order', () => {
    expect(firstEnvFileOutput(
        {b: 2, a: 1},
        ['a', 'b'],
        )).toBe(1);
    expect(firstEnvFileOutput({_: {status: 200}, session: 'x'}, ['session']))
        .toBe('x');
    expect(firstEnvFileOutput(
        {session: '__MMT_OMIT__', next: 'ok'}, ['session', 'next']))
        .toBe('ok');
    expect(firstEnvFileOutput({})).toBe(null);
  });

  it('plainEnvValuesForClone restores ./ paths from getters', () => {
    const store = createEnvStore({session: './a.mmt', n: 1});
    expect(plainEnvValuesForClone(store.values)).toEqual({
      session: './a.mmt',
      n: 1,
    });
  });

  it('concurrent getter calls share one runEnvFile instead of returning null',
     async () => {
       const store = createEnvStore({session: './a.mmt'});
       let runs = 0;
       store.runEnvFile = async () => {
         runs += 1;
         await new Promise(r => setTimeout(r, 20));
         return {outputs: {session: 'shared'}, outputKeys: ['session'], cache: '1h'};
       };
       const getter = store.values.session as () => Promise<any>;
       const [a, b, c] = await Promise.all([getter(), getter(), getter()]);
       expect([a, b, c]).toEqual(['shared', 'shared', 'shared']);
       expect(runs).toBe(1);
     });
});
