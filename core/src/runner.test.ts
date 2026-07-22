import {ApiLogRawValue, createApiLogHelpers} from './runApi';

describe('createApiLogHelpers', () => {
  it('wraps raw values and detects them correctly', () => {
    const helpers = createApiLogHelpers();
    const rawValue = helpers.raw(123);

    expect(rawValue).toEqual({__mmt_raw: '123'});
    expect(helpers.isRaw(rawValue)).toBe(true);
    expect(helpers.isRaw({})).toBe(false);
  });

  it('formats structured sections with aligned output', () => {
    const helpers = createApiLogHelpers();

    const section = helpers.formatSection('REQUEST', {
      method: helpers.raw('GET'),
      headers: {Accept: 'json'},
      duration: helpers.formatDuration(125),
    });

    expect(section).toBe(
        `REQUEST\n  method:    GET\n  headers:\n    {\n      Accept:  "json"\n    }\n  duration:  125ms`);
  });

  it('formats nested values with indentation', () => {
    const helpers = createApiLogHelpers();

    const value =
        helpers.formatValue({alpha: 'beta', nested: [1, {two: 2}]}, 2);
    expect(value).toBe(
        `  {\n    alpha:   "beta"\n    nested:\n      [\n        1\n        {\n          two:  2\n        }\n      ]\n  }`);
  });

  it('normalises body values intelligently', () => {
    const helpers = createApiLogHelpers();

    expect(helpers.formatBodyValue(null)).toBe('');
    expect(helpers.formatBodyValue(undefined)).toBe('');
    expect(helpers.formatBodyValue('   ')).toBe('');
    expect(helpers.formatBodyValue('{"foo":"bar"}')).toEqual({foo: 'bar'});
    expect(helpers.formatBodyValue('not json')).toBe('not json');
    expect(helpers.formatBodyValue({raw: true})).toEqual({raw: true});
  });

  it('produces raw duration values', () => {
    const helpers = createApiLogHelpers();

    const formatted = helpers.formatDuration(321) as ApiLogRawValue;
    const blank = helpers.formatDuration('skip') as ApiLogRawValue;
    const overOneSecond = helpers.formatDuration(1234) as ApiLogRawValue;

    expect(formatted).toEqual({__mmt_raw: '321ms'});
    expect(blank).toEqual({__mmt_raw: ''});
    expect(overOneSecond).toEqual({__mmt_raw: '1234ms'});
  });

  it('formats Expects with pass/fail marks', () => {
    const helpers = createApiLogHelpers();

    expect(helpers.valuesMatch('a', 'a')).toBe(true);
    expect(helpers.valuesMatch(1, '1')).toBe(true);
    expect(helpers.valuesMatch({a: 1}, {a: 1})).toBe(true);
    expect(helpers.valuesMatch('a', 'b')).toBe(false);

    const allPass = helpers.formatExpects({s: 'ok'}, {s: 'ok'}, 'Echo API');
    expect(allPass.successLines).toEqual(['\u2713 Check "Echo API" - "s == ok"']);
    expect(allPass.failLines).toEqual([]);

    const mixed = helpers.formatExpects(
        {s: 'ok', ss: 12, d: '__MMT_OMIT_KEYWORD__'},
        {s: 'ok', ss: 13, d: '__MMT_OMIT_KEYWORD__'}, 'Echo API');
    expect(mixed.successLines).toEqual([
      '\u2713 Check "Echo API" - "s == ok"',
      '\u2713 Check "Echo API" - "d == omit"',
    ]);
    expect(mixed.failLines).toEqual([
      '\u00D7 Check "Echo API" - "ss == 13" (12 == 13)',
    ]);

    const allFail = helpers.formatExpects({s: 1}, {s: 2}, 'Echo API');
    expect(allFail.successLines).toEqual([]);
    expect(allFail.failLines).toEqual([
      '\u00D7 Check "Echo API" - "s == 2" (1 == 2)',
    ]);
  });
});
