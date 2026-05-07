import {check_, checkExpects_} from './testHelper';

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
