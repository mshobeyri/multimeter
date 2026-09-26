import {
  collectRuntimeLeaves,
  findRuntimeValueRangesInJson,
  findRuntimeValueRangesInPlainText,
  runtimeTokenKeys,
  stringContainsRuntimeToken,
} from './runtimeTokenUi';

describe('stringContainsRuntimeToken', () => {
  it('detects plain and angle r:/c: tokens', () => {
    expect(stringContainsRuntimeToken('r:uuid')).toBe(true);
    expect(stringContainsRuntimeToken('c:date')).toBe(true);
    expect(stringContainsRuntimeToken('<<r:uuid>>')).toBe(true);
    expect(stringContainsRuntimeToken('id-<<c:epoch_ms>>')).toBe(true);
    expect(stringContainsRuntimeToken('e:api_url')).toBe(false);
    expect(stringContainsRuntimeToken('hello')).toBe(false);
  });
});

describe('collectRuntimeLeaves + findRuntimeValueRangesInJson', () => {
  it('collects resolved leaves and finds their JSON ranges', () => {
    const source = {id: 'r:uuid', created: 'c:date', static: 'ok'};
    const resolved = {
      id: '11111111-1111-1111-1111-111111111111',
      created: '2026-01-01',
      static: 'ok',
    };
    const leaves = collectRuntimeLeaves(source, resolved);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((leaf) => leaf.key).sort()).toEqual(['created', 'id']);

    const text = JSON.stringify(resolved, null, 2);
    const ranges = findRuntimeValueRangesInJson(text, leaves);
    expect(ranges.length).toBe(2);
    for (const range of ranges) {
      expect(range.startLineNumber).toBeGreaterThan(0);
      expect(range.endColumn).toBeGreaterThan(range.startColumn);
    }
  });
});

describe('findRuntimeValueRangesInPlainText', () => {
  it('finds unquoted resolved strings in plain text', () => {
    const leaves = collectRuntimeLeaves('prefix-<<r:uuid>>', 'prefix-abc');
    const ranges = findRuntimeValueRangesInPlainText('prefix-abc', leaves);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startColumn).toBe(1);
    expect(ranges[0].endColumn).toBe('prefix-abc'.length + 1);
  });
});

describe('runtimeTokenKeys', () => {
  it('returns keys whose values contain runtime tokens', () => {
    expect([...runtimeTokenKeys({
      Authorization: 'Bearer r:uuid',
      Accept: 'application/json',
      stamp: 'c:epoch_ms',
    })].sort()).toEqual(['Authorization', 'stamp']);
  });
});
