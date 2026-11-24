import { revealSuiteFailurePath, type SuiteRevealItem } from './revealSuiteFailure';

function items(): Record<string, SuiteRevealItem> {
  return {
    'suite-root': { children: ['group-1'], data: { type: 'root' } },
    'group-1': { children: ['entry-a', 'entry-b'], data: { type: 'group', id: 'suite-node:0' } },
    'entry-a': {
      children: ['entry-a::suite-node:0.0'],
      data: { type: 'suite', id: 'suite-node:0.0' },
    },
    'entry-a::suite-node:0.0': {
      children: [],
      data: { type: 'test', id: 'suite-node:0.0.0' },
    },
    'entry-b': {
      children: ['entry-b::suite-node:0.1'],
      data: { type: 'suite', id: 'suite-node:0.1' },
    },
    'entry-b::suite-node:0.1': {
      children: ['entry-b::suite-node:0.1::suite-node:0.1.0'],
      data: { type: 'suite', id: 'suite-node:0.1.0' },
    },
    'entry-b::suite-node:0.1::suite-node:0.1.0': {
      children: [],
      data: { type: 'test', id: 'suite-node:0.1.0.0' },
    },
  };
}

const failed = new Set(['entry-b', 'entry-b::suite-node:0.1', 'entry-b::suite-node:0.1::suite-node:0.1.0']);

describe('revealSuiteFailurePath', () => {
  it('opens boxes down to the first failed test', () => {
    const hit = revealSuiteFailurePath(items(), (id) => failed.has(id), []);
    expect(hit).toEqual({
      expandIds: [
        'suite-root',
        'group-1',
        'entry-b',
        'entry-b::suite-node:0.1',
        'entry-b::suite-node:0.1::suite-node:0.1.0',
      ],
      terminalId: 'entry-b::suite-node:0.1::suite-node:0.1.0',
      needsChildren: false,
    });
  });

  it('starts at the double-clicked failed suite', () => {
    const hit = revealSuiteFailurePath(
      items(),
      (id) => failed.has(id),
      [],
      'entry-b::suite-node:0.1',
    );
    expect(hit?.expandIds).toEqual([
      'entry-b::suite-node:0.1',
      'entry-b::suite-node:0.1::suite-node:0.1.0',
    ]);
    expect(hit?.terminalId).toBe('entry-b::suite-node:0.1::suite-node:0.1.0');
  });

  it('waits when the failed case is not loaded yet', () => {
    const partial: Record<string, SuiteRevealItem> = {
      'suite-root': { children: ['entry-b'], data: { type: 'root' } },
      'entry-b': { children: [], data: { type: 'suite', id: 'suite-node:0.1' } },
    };
    const hit = revealSuiteFailurePath(
      partial,
      (id) => id === 'entry-b',
      ['suite-node:0.1.0.0'],
    );
    expect(hit).toEqual({
      expandIds: ['suite-root', 'entry-b'],
      terminalId: 'entry-b',
      needsChildren: true,
    });
  });

  it('returns null when nothing failed', () => {
    expect(revealSuiteFailurePath(items(), () => false, [])).toBeNull();
  });
});