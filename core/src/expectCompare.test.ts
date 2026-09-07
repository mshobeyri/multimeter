import {
  evaluateComparison,
  evaluateExpectValue,
  matchExpectMap,
  matchHeaderExpectMap,
} from './expectCompare';
import {OMIT_SENTINEL} from './omitKeyword';

describe('evaluateComparison', () => {
  it('covers equality family', () => {
    expect(evaluateComparison('hi', '==', 'hi')).toBe(true);
    expect(evaluateComparison('hi', '!=', 'bye')).toBe(true);
    expect(evaluateComparison('Hi', '=i', 'hi')).toBe(true);
    expect(evaluateComparison('  hi  ', '=X', 'hi')).toBe(true);
    expect(evaluateComparison('  Hi  ', '=iX', 'hi')).toBe(true);
    expect(evaluateComparison(true, '=~', 'true')).toBe(true);
  });

  it('covers contains / starts / ends / regex', () => {
    expect(evaluateComparison('hello world', '=C', 'lo w')).toBe(true);
    expect(evaluateComparison('hello', '!C', 'x')).toBe(true);
    expect(evaluateComparison('hello', '=^', 'he')).toBe(true);
    expect(evaluateComparison('hello', '=$', 'lo')).toBe(true);
    expect(evaluateComparison('abc123', '=*', '/\\d+/')).toBe(true);
    expect(evaluateComparison('abc', '!*', '/\\d+/')).toBe(true);
  });

  it('covers numeric and length operators', () => {
    expect(evaluateComparison(10, '>', 3)).toBe(true);
    expect(evaluateComparison(2, '<=', 2)).toBe(true);
    expect(evaluateComparison(['a', 'b'], '=#', 2)).toBe(true);
    expect(evaluateComparison('abcd', '>#', 2)).toBe(true);
  });

  it('covers omit and membership', () => {
    expect(evaluateComparison(undefined, '==', null)).toBe(true);
    expect(evaluateComparison('x', '!=', null)).toBe(true);
    expect(evaluateComparison(OMIT_SENTINEL, '==', null)).toBe(true);
    expect(evaluateComparison('a', '=@', 'a,b,c')).toBe(true);
  });

  it('covers fuzzy percent operators', () => {
    expect(evaluateComparison('John', '>50%', 'Jon')).toBe(true);
    expect(evaluateComparison('abcdef', '<10%', 'zzzzzz')).toBe(true);
  });

  it('returns false for unknown operators', () => {
    expect(evaluateComparison(1, '??', 1)).toBe(false);
  });
});

describe('evaluateExpectValue', () => {
  it('parses operator prefixes like check/expect', () => {
    expect(evaluateExpectValue('hello', '=C ell')).toBe(true);
    expect(evaluateExpectValue('hello', '!= bye')).toBe(true);
    expect(evaluateExpectValue('hello', 'hi')).toBe(false);
    expect(evaluateExpectValue(200, '== 200')).toBe(true);
    expect(evaluateExpectValue(undefined, '== omit')).toBe(true);
  });
});

describe('matchExpectMap', () => {
  it('matches nested maps and dotted paths', () => {
    const actual = {user: {name: 'Ada', role: 'admin'}, tags: ['a', 'b']};
    expect(matchExpectMap({user: {name: 'Ada'}}, actual)).toBe(true);
    expect(matchExpectMap({'user.name': 'Ada'}, actual)).toBe(true);
    expect(matchExpectMap({'user.name': '=C Ad'}, actual)).toBe(true);
    expect(matchExpectMap({'user.role': '!= user'}, actual)).toBe(true);
    expect(matchExpectMap({'tags[0]': 'a'}, actual)).toBe(true);
    expect(matchExpectMap({'tags': '=# 2'}, actual)).toBe(true);
  });

  it('fails when any rule fails', () => {
    expect(matchExpectMap({'user.name': 'Ada', 'user.role': 'user'}, {
      user: {name: 'Ada', role: 'admin'},
    })).toBe(false);
  });

  it('supports omit on missing paths', () => {
    expect(matchExpectMap({'missing.field': '== omit'}, {user: 1})).toBe(true);
    expect(matchExpectMap({'user': '!= omit'}, {user: 1})).toBe(true);
  });
});

describe('matchHeaderExpectMap', () => {
  it('matches header names case-insensitively with operators', () => {
    expect(matchHeaderExpectMap(
        {authorization: '=C Bearer'},
        {Authorization: 'Bearer token'})).toBe(true);
    expect(matchHeaderExpectMap(
        {authorization: '=C Bearer'},
        {Authorization: 'Basic x'})).toBe(false);
  });
});
