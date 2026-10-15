import {
  isList,
  isNonEmptyList,
  isNonEmptyObject,
  safeList,
  safeListCopy,
} from './safer';

describe('safer helpers', () => {
  test('safeList and isList', () => {
    expect(safeList([1])).toEqual([1]);
    expect(safeList(null)).toEqual([]);
    expect(safeList(undefined)).toEqual([]);
    expect(safeList('x')).toEqual([]);
    expect(isList([1])).toBe(true);
    expect(isList(null)).toBeFalsy();
    expect(isList({})).toBeFalsy();
  });

  test('safeListCopy does not alias the source', () => {
    const src = [1];
    const copy = safeListCopy(src);
    expect(copy).toEqual([1]);
    copy.push(2);
    expect(src).toEqual([1]);
    expect(safeListCopy(undefined)).toEqual([]);
  });

  test('non-empty object and list guards', () => {
    expect(isNonEmptyObject({a: 1})).toBe(true);
    expect(isNonEmptyObject({})).toBe(false);
    expect(isNonEmptyObject([])).toBe(false);
    expect(isNonEmptyObject(null)).toBeFalsy();
    expect(isNonEmptyList([1])).toBe(true);
    expect(isNonEmptyList([])).toBe(false);
    expect(isNonEmptyList(undefined)).toBeFalsy();
  });
});
