import {maxItemsPerRow, packTypeRows} from './notypeTypeRows';

describe('packTypeRows', () => {
  const seven = [1, 2, 3, 4, 5, 6, 7];

  it('keeps a single row when everything fits', () => {
    expect(packTypeRows(seven, 7)).toEqual([seven]);
  });

  it('moves a lone leftover onto a second row with two items', () => {
    expect(packTypeRows(seven, 6)).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
  });

  it('keeps 5+2 and 4+3 balanced', () => {
    expect(packTypeRows(seven, 5)).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
    expect(packTypeRows(seven, 4)).toEqual([[1, 2, 3, 4], [5, 6, 7]]);
  });

  it('turns 3+3+1 into 3+2+2', () => {
    expect(packTypeRows(seven, 3)).toEqual([[1, 2, 3], [4, 5], [6, 7]]);
  });

  it('returns empty rows for no items', () => {
    expect(packTypeRows([], 4)).toEqual([]);
  });
});

describe('maxItemsPerRow', () => {
  it('counts how many 72px items fit with a 12px gap', () => {
    expect(maxItemsPerRow(72, 72, 12)).toBe(1);
    expect(maxItemsPerRow(72 + 12 + 72, 72, 12)).toBe(2);
    expect(maxItemsPerRow(6 * 72 + 5 * 12, 72, 12)).toBe(6);
  });
});
