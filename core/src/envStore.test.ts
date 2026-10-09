import {cloneEnvStore, createEnvStore} from './envStore';

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
});
