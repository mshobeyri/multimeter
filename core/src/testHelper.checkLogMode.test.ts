import {
  AssertionFailedError,
  check_,
  checkAbort_,
  checkExpects_,
  contains_,
  equals_,
  equalsAsString_,
  equalsIgnoreCase_,
  fuzzyMatch_,
  greater_,
  greaterOrEqual_,
  isAt_,
  isAssertionFailedError,
  isNotAt_,
  isNotOmitted_,
  isOmitted_,
  isServerRunning_,
  isTestAbortError,
  judge_,
  lengthEquals_,
  lengthGreater_,
  lengthGreaterOrEqual_,
  lengthLess_,
  lengthLessOrEqual_,
  lengthOf_,
  less_,
  lessOrEqual_,
  matches_,
  notContains_,
  notEquals_,
  notEqualsAsString_,
  notEqualsIgnoreCase_,
  notFuzzyMatch_,
  notLengthEquals_,
  notMatches_,
  notTrimEquals_,
  notTrimEqualsIgnoreCase_,
  protocolFromUrl_,
  registerServer_,
  reportWithContext_,
  setAbortSignal_,
  setenv_,
  setenvWithContext_,
  setServerRunner_,
  similarityPercent_,
  startServer_,
  stopAllServers_,
  TestAbortError,
  trimEquals_,
  trimEqualsIgnoreCase_,
} from './testHelper';

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

  it('checks length inequalities', () => {
    expect(lengthLess_([1, 2], 3)).toBe(true);
    expect(lengthLessOrEqual_([1, 2], 2)).toBe(true);
    expect(lengthGreater_('abcd', 3)).toBe(true);
    expect(lengthGreaterOrEqual_({a: 1}, 1)).toBe(true);
  });

  it('checks ignore-case and trim equality', () => {
    expect(equalsIgnoreCase_('John', 'john')).toBe(true);
    expect(notEqualsIgnoreCase_('John', 'jane')).toBe(true);
    expect(trimEquals_('  hi  ', 'hi')).toBe(true);
    expect(notTrimEquals_('  hi  ', 'hey')).toBe(true);
    expect(trimEqualsIgnoreCase_('  John ', 'john')).toBe(true);
    expect(notTrimEqualsIgnoreCase_('  John ', 'jane')).toBe(true);
  });

  it('treats omit sentinel as omitted in equals_', () => {
    expect(isOmitted_(undefined)).toBe(true);
    expect(isOmitted_(null)).toBe(true);
    expect(isOmitted_('__MMT_OMIT__')).toBe(true);
    expect(isNotOmitted_('value')).toBe(true);
    expect(equals_(undefined, '__MMT_OMIT__')).toBe(true);
    expect(equals_('__MMT_OMIT__', null)).toBe(true);
    expect(equals_('present', '__MMT_OMIT__')).toBe(false);
    expect(notEquals_('present', '__MMT_OMIT__')).toBe(true);
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
      'mehrdad zahra >80% mehrdad sahar',
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

  it('checks is-at and contains on multi-line outputs', () => {
    const body = 'status: ok\nmessage: hello\nid: 42\n';

    expect(isAt_('message: hello', body)).toBe(true);
    expect(isAt_('missing', body)).toBe(false);
    expect(isNotAt_('missing', body)).toBe(true);

    expect(contains_(body, 'message: hello')).toBe(true);
    expect(contains_(body, 'status: ok\nmessage: hello')).toBe(true);
    expect(contains_(body, 'goodbye')).toBe(false);
    expect(notContains_(body, 'goodbye')).toBe(true);
  });

  it('stringifies objects for contains, is-at, and regex match', () => {
    const body = {
      method: 'POST',
      url: 'https://test.mmt.dev/echo',
      path: '/echo',
      body: { message: 'hello world' },
    };

    expect(contains_(body, 'POST')).toBe(true);
    expect(contains_(body, 'hello world')).toBe(true);
    expect(contains_(body, 'PUT')).toBe(false);
    expect(isAt_('POST', body)).toBe(true);
    expect(isAt_('GET', body)).toBe(false);
    expect(matches_(body, '/"method":"POST"/')).toBe(true);
    expect(matches_(body, '/"method":"GET"/')).toBe(false);
    expect(notContains_(body, 'PUT')).toBe(true);
  });

  it('checks regex match on multi-line outputs', () => {
    const body = 'status: ok\nmessage: hello\nid: 42\n';

    expect(matches_(body, '/message: hello/')).toBe(true);
    expect(matches_(body, '/^message: hello$/m')).toBe(true);
    expect(matches_(body, '/status: ok.*id: 42/s')).toBe(true);
    expect(matches_(body, '/^id: 99$/m')).toBe(false);
    expect(notMatches_(body, '/^id: 99$/m')).toBe(true);
  });

  it('deeply compares objects and arrays for equality', () => {
    expect(equals_({ message: 'hello', meta: { ok: true } }, { message: 'hello', meta: { ok: true } })).toBe(true);
    expect(equals_([1, { id: 2 }, 3], [1, { id: 2 }, 3])).toBe(true);
    expect(notEquals_({ message: 'hello' }, { message: 'bye' })).toBe(true);
    expect(notEquals_([1, 2], [2, 1])).toBe(true);
    expect(equals_({a: 1}, {a: 1, b: 2})).toBe(false);
    expect(equals_([1], [1, 2])).toBe(false);
    expect(equals_([1, 2], [1, 3])).toBe(false);
    expect(equals_({a: 1}, {b: 1})).toBe(false);
    expect(equals_(null, {})).toBe(false);
    expect(less_(1, 2)).toBe(true);
    expect(greater_(2, 1)).toBe(true);
    expect(lessOrEqual_(2, 2)).toBe(true);
    expect(greaterOrEqual_(3, 2)).toBe(true);
    expect(equalsAsString_(true, 'true')).toBe(true);
    expect(notEqualsAsString_('a', 'b')).toBe(true);
    expect(equalsAsString_(undefined, '__MMT_OMIT__')).toBe(true);
    expect(equalsAsString_('__MMT_OMIT__', null)).toBe(true);
    expect(protocolFromUrl_('wss://x')).toBe('ws');
    expect(protocolFromUrl_('https://x')).toBe('http');
    expect(protocolFromUrl_('')).toBe('http');
  });
});

describe('testHelper abort, servers, setenv, judge, check branches', () => {
  afterEach(() => {
    setAbortSignal_(undefined);
    setServerRunner_(undefined);
    stopAllServers_();
  });

  it('throws TestAbortError when aborted and classifies abort/assert errors', () => {
    setAbortSignal_(AbortSignal.abort());
    expect(() => checkAbort_()).toThrow(TestAbortError);
    expect(isTestAbortError(new TestAbortError())).toBe(true);
    expect(isTestAbortError({kind: 'test-abort'})).toBe(true);
    expect(isTestAbortError(new Error('x'))).toBe(false);
    expect(isAssertionFailedError(new AssertionFailedError())).toBe(true);
    expect(isAssertionFailedError({kind: 'assertion-failed'})).toBe(true);
  });

  it('starts servers idempotently and ignores cleanup errors', async () => {
    await expect(startServer_('mock')).rejects.toThrow('no server runner');
    let starts = 0;
    setServerRunner_(async () => {
      starts += 1;
      return () => {
        throw new Error('cleanup');
      };
    });
    await startServer_('mock');
    await startServer_('mock');
    expect(starts).toBe(1);
    expect(isServerRunning_('mock')).toBe(true);
    registerServer_('other', () => {});
    stopAllServers_();
    expect(isServerRunning_('mock')).toBe(false);
  });

  it('ignores empty setenv and reporter throws', () => {
    setenv_({} as any);
    setenvWithContext_(undefined, undefined, undefined, undefined as any);
    const throwing = () => {
      throw new Error('reporter down');
    };
    expect(() => setenvWithContext_(throwing, 'run', 'id', {A: 1})).not.toThrow();
    expect(() => reportWithContext_(throwing, 'run-x', 'id-x', 'check', 'x == 1', undefined, '{"_":{"cached":true}}', true)).not.toThrow();
  });

  it('logs failed checks with details and throws on failed assert', () => {
    const consoleFn = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    };
    const reportFn = jest.fn();
    check_(true, 'check', 'a == 1', 'fails', undefined, undefined, 1, 1, reportFn, consoleFn);
    expect(consoleFn.debug).toHaveBeenCalled();
    check_(true, 'check', 'a == 1', 'none', undefined, undefined, 1, 1, reportFn, consoleFn);
    expect(consoleFn.trace).toHaveBeenCalled();
    check_(
        false, 'check', 'a == 1', 'all', 't', '{"x":1}', 2, 1, reportFn, consoleFn);
    expect(consoleFn.error).toHaveBeenCalled();
    expect(consoleFn.debug).toHaveBeenCalled();
    expect(() => check_(false, 'assert', 'a == 1', 'all', undefined, undefined, 2, 1, reportFn, consoleFn))
        .toThrow(AssertionFailedError);
  });

  it('covers checkExpects debug, fails/none levels, and assert throw', () => {
    const consoleFn = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    };
    const reportFn = jest.fn();
    checkExpects_(
        [{passed: true, comparison: 'a == 1', actual: 1, expected: 1}],
        'debug', 'all', 't', undefined, reportFn, consoleFn);
    checkExpects_(
        [{passed: true, comparison: 'a == 1', actual: 1, expected: 1}],
        'check', 'fails', 't', undefined, reportFn, consoleFn);
    checkExpects_(
        [{passed: true, comparison: 'a == 1', actual: 1, expected: 1}],
        'check', 'none', 't', undefined, reportFn, consoleFn);
    checkExpects_(
        [{passed: false, comparison: 'a == 1', actual: 2, expected: 1}],
        'check', 'none', 't', '{"a":1}', reportFn, consoleFn);
    expect(() => checkExpects_(
        [{passed: false, comparison: 'a == 1', actual: 2, expected: 1, level: 'require'}],
        'assert', 'all', 't', '{"a":1}', reportFn, consoleFn)).toThrow(AssertionFailedError);
  });

  it('judge_ fails hard without a judge definition or expect/require', async () => {
    await expect(judge_({} as any, {}, 'all', 't', jest.fn(), {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    })).rejects.toThrow(AssertionFailedError);
    await expect(judge_({type: 'judge'} as any, {}, 'all', 't', jest.fn(), {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      trace: jest.fn(),
    })).rejects.toThrow(AssertionFailedError);
  });
});
