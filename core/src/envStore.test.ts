import {
  cloneEnvStore,
  createEnvStore,
  envFilePathOfGetter,
  firstEnvFileOutput,
  isEnvFilePathValue,
  plainEnvValuesForClone,
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
    expect(firstEnvFileOutput({})).toBe(null);
  });

  it('plainEnvValuesForClone restores ./ paths from getters', () => {
    const store = createEnvStore({session: './a.mmt', n: 1});
    expect(plainEnvValuesForClone(store.values)).toEqual({
      session: './a.mmt',
      n: 1,
    });
  });
});
