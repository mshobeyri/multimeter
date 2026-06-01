import {check_, checkExpects_, equals_, fuzzyMatch_, lengthEquals_, lengthOf_, matches_, notEquals_, notFuzzyMatch_, notLengthEquals_, notMatches_, reportWithContext_, similarityPercent_} from './testHelper';

describe('testHelper checkLogMode', () => {
  function makeConsole() {
    return {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    };
  }

  it('suppresses passed check console output without suppressing report events', () => {
    const consoleFn = makeConsole();
    const reportFn = jest.fn();

    check_(
      true,
      'check',
      'status_field == ok',
      'all',
      'Health Check',
      undefined,
      'ok',
      'ok',
      reportFn,
      consoleFn,
      'failures-only',
    );

    expect(consoleFn.log).not.toHaveBeenCalled();
    expect(consoleFn.debug).not.toHaveBeenCalled();
    expect(consoleFn.trace).not.toHaveBeenCalled();
    expect(consoleFn.error).not.toHaveBeenCalled();
    expect(reportFn).toHaveBeenCalledWith('check', 'status_field == ok', 'Health Check', undefined, true);
  });

  it('still logs failed checks in failures-only mode', () => {
    const consoleFn = makeConsole();
    const reportFn = jest.fn();

    check_(
      false,
      'check',
      'status_field == ok',
      'all',
      'Health Check',
      undefined,
      'bad',
      'ok',
      reportFn,
      consoleFn,
      'failures-only',
    );

    expect(consoleFn.error).toHaveBeenCalledTimes(1);
    expect(reportFn).toHaveBeenCalledWith('check', 'status_field == ok', 'Health Check', undefined, false, 'bad', 'ok');
  });

  it('suppresses passed batched expect console output without suppressing report events', () => {
    const consoleFn = makeConsole();
    const reportFn = jest.fn();
    const expects = [{passed: true, comparison: 'status_field == ok', actual: 'ok', expected: 'ok'}];

    checkExpects_(expects, 'check', 'all', 'Health Check', undefined, reportFn, consoleFn, 'failures-only');

    expect(consoleFn.log).not.toHaveBeenCalled();
    expect(consoleFn.debug).not.toHaveBeenCalled();
    expect(consoleFn.trace).not.toHaveBeenCalled();
    expect(consoleFn.error).not.toHaveBeenCalled();
    expect(reportFn).toHaveBeenCalledWith('check', expects, 'Health Check', undefined, true);
  });

  it('suppresses failed check console output in none mode without suppressing report events', () => {
    const consoleFn = makeConsole();
    const reportFn = jest.fn();

    check_(
      false,
      'check',
      'status_field == ok',
      'all',
      'Health Check',
      undefined,
      'bad',
      'ok',
      reportFn,
      consoleFn,
      'none',
    );

    expect(consoleFn.log).not.toHaveBeenCalled();
    expect(consoleFn.debug).not.toHaveBeenCalled();
    expect(consoleFn.trace).not.toHaveBeenCalled();
    expect(consoleFn.error).not.toHaveBeenCalled();
    expect(reportFn).toHaveBeenCalledWith('check', 'status_field == ok', 'Health Check', undefined, false, 'bad', 'ok');
  });

  it('suppresses failed batched expect console output in none mode without suppressing report events', () => {
    const consoleFn = makeConsole();
    const reportFn = jest.fn();
    const expects = [{passed: false, comparison: 'status_field == ok', actual: 'bad', expected: 'ok'}];

    checkExpects_(expects, 'check', 'all', 'Health Check', 'details', reportFn, consoleFn, 'none');

    expect(consoleFn.log).not.toHaveBeenCalled();
    expect(consoleFn.debug).not.toHaveBeenCalled();
    expect(consoleFn.trace).not.toHaveBeenCalled();
    expect(consoleFn.error).not.toHaveBeenCalled();
    expect(reportFn).toHaveBeenCalledWith('check', expects, 'Health Check', 'details', false);
  });
});

describe('testHelper comparison helpers', () => {
  it('checks length and item count equality', () => {
    expect(lengthEquals_([1, 2, 3], 3)).toBe(true);
    expect(lengthEquals_({a: 1, b: 2}, 2)).toBe(true);
    expect(lengthEquals_({a: {id: 1}, b: {id: 2}, c: 'x'}, 3)).toBe(true);
    expect(lengthEquals_('abcd', 4)).toBe(true);
    expect(lengthEquals_(1234, 4)).toBe(true);
    expect(notLengthEquals_([1, 2], 3)).toBe(true);
    expect(lengthOf_({a: 1, b: 2})).toBe(2);
  });

  it('reports count for passed length/count comparisons', () => {
    const reporter = jest.fn();

    reportWithContext_(
      reporter,
      'run-1',
      'node-1',
      'check',
      'users =# 3',
      'user count',
      undefined,
      true,
      ['a', 'b', 'c'],
      3,
    );

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0].expects[0]).toMatchObject({
      status: 'passed',
      actual: ['a', 'b', 'c'],
      expected: 3,
      count: 3,
    });
  });

  it('reports count for passed negative length/count comparisons', () => {
    const reporter = jest.fn();

    reportWithContext_(
      reporter,
      'run-1',
      'node-1',
      'check',
      'users !# 0',
      'user count',
      undefined,
      true,
      {a: 1, b: 2},
      0,
    );

    expect(reporter.mock.calls[0][0].expects[0]).toMatchObject({
      status: 'passed',
      actual: {a: 1, b: 2},
      expected: 0,
      count: 2,
    });
  });

  it('checks fuzzy percentage similarity', () => {
    expect(fuzzyMatch_('John', 'Jon', 70)).toBe(true);
    expect(fuzzyMatch_('John', 'admin', 80)).toBe(false);
    expect(notFuzzyMatch_('John', 'admin', 80)).toBe(true);
    expect(similarityPercent_('John', 'Jon')).toBeGreaterThan(0);
    expect(similarityPercent_('mehrdad zahra', 'mehrdad sahar')).toBe(77);
    expect(fuzzyMatch_('mehrdad zahra', 'mehrdad sahar', 77)).toBe(true);
    expect(notFuzzyMatch_('mehrdad zahra', 'mehrdad sahar', 77)).toBe(false);
    expect(fuzzyMatch_('mehrdad zahra', 'mehrdad sahar', 78)).toBe(false);
    expect(fuzzyMatch_('mehrdad zahra', 'mehrdad sahar', 100)).toBe(false);
  });

  it('reports similarity for passed fuzzy comparisons with spaces', () => {
    const reporter = jest.fn();

    reportWithContext_(
      reporter,
      'run-1',
      'node-1',
      'check',
      'mehrdad zahra =80% mehrdad sahar',
      'fuzzy name',
      undefined,
      true,
      'mehrdad zahra',
      'mehrdad sahar',
    );

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0].expects[0]).toMatchObject({
      status: 'passed',
      actual: 'mehrdad zahra',
      expected: 'mehrdad sahar',
      similarity: 77,
    });
  });

  it('checks regex strings and slash literals', () => {
    expect(matches_('John', '/john/i')).toBe(true);
    expect(matches_('john@example.com', '@example\\.com$')).toBe(true);
    expect(notMatches_('admin', '/^user/')).toBe(true);
  });

  it('deeply compares objects and arrays for equality', () => {
    expect(equals_({ message: 'hello', meta: { ok: true } }, { message: 'hello', meta: { ok: true } })).toBe(true);
    expect(equals_([1, { id: 2 }, 3], [1, { id: 2 }, 3])).toBe(true);
    expect(notEquals_({ message: 'hello' }, { message: 'bye' })).toBe(true);
    expect(notEquals_([1, 2], [2, 1])).toBe(true);
  });
});
