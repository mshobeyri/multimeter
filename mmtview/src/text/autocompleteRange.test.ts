import {completionRange, withRange, wordCompletionRange} from './autocompleteRange';

describe('autocompleteRange', () => {
  const position = {lineNumber: 4, column: 12};

  it('builds a same-line replace range', () => {
    expect(completionRange(position, 8)).toEqual({
      startLineNumber: 4,
      startColumn: 8,
      endLineNumber: 4,
      endColumn: 12,
    });
  });

  it('uses the word bounds when present', () => {
    expect(wordCompletionRange(position, {startColumn: 3, endColumn: 7})).toEqual({
      startLineNumber: 4,
      startColumn: 3,
      endLineNumber: 4,
      endColumn: 7,
    });
  });

  it('attaches the same range to every suggestion', () => {
    const range = completionRange(position, 1, 5);
    expect(withRange([{label: 'a'}, {label: 'b'}], range)).toEqual([
      {label: 'a', range},
      {label: 'b', range},
    ]);
  });
});
