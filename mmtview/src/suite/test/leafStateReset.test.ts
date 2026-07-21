import { resetLeafStateMap } from './leafStateReset';

describe('resetLeafStateMap', () => {
  it('returns empty map when resetting all', () => {
    const state = { a: 'passed', b: 'failed' } as Record<string, string>;
    const next = resetLeafStateMap(state, 'all');
    expect(next).toEqual({});
    expect(state).toEqual({ a: 'passed', b: 'failed' });
  });

  it('removes only targeted leaf ids', () => {
    const state = { a: 'passed', b: 'failed', c: 'running' } as Record<string, string>;
    const next = resetLeafStateMap(state, ['b']);
    expect(next).toEqual({ a: 'passed', c: 'running' });
    expect(state).toEqual({ a: 'passed', b: 'failed', c: 'running' });
  });

  it('removes descendant bundle ids under a targeted parent', () => {
    const state = {
      'suite-node:1.0': 'running',
      'suite-node:1.0.0.0': 'failed',
      'suite-node:1.0.0.1': 'passed',
      'suite-node:1.1': 'passed',
      'suite-node:1.10': 'passed',
    } as Record<string, string>;
    const next = resetLeafStateMap(state, ['suite-node:1.0']);
    expect(next).toEqual({
      'suite-node:1.1': 'passed',
      'suite-node:1.10': 'passed',
    });
  });

  it('returns same reference when no targets removed', () => {
    const state = { a: 'passed' } as Record<string, string>;
    const next = resetLeafStateMap(state, ['missing']);
    expect(next).toBe(state);
  });
});
