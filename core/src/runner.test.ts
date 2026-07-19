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

    expect(formatted).toEqual({__mmt_raw: '321ms'});
    expect(blank).toEqual({__mmt_raw: ''});
  });

  it('formats Expects with pass/fail marks', () => {
    const helpers = createApiLogHelpers();

    expect(helpers.valuesMatch('a', 'a')).toBe(true);
    expect(helpers.valuesMatch(1, '1')).toBe(true);
    expect(helpers.valuesMatch({a: 1}, {a: 1})).toBe(true);
    expect(helpers.valuesMatch('a', 'b')).toBe(false);

    const allPass = helpers.formatExpects({s: 'ok'}, {s: 'ok'});
    expect(allPass.successText).toBe('Expects:\n  \u2713 s');
    expect(allPass.failText).toBe('');

    const mixed = helpers.formatExpects(
        {s: 'ok', ss: 12, d: '__MMT_OMIT_KEYWORD__'},
        {s: 'ok', ss: 13, d: '__MMT_OMIT_KEYWORD__'});
    expect(mixed.successText).toBe('Expects:\n  \u2713 s\n  \u2713 d');
    expect(mixed.failText).toBe('Expects:\n  \u00D7 ss (12 \u2260 13)');

    const allFail = helpers.formatExpects({s: 1}, {s: 2});
    expect(allFail.successText).toBe('');
    expect(allFail.failText).toBe('Expects:\n  \u00D7 s (1 \u2260 2)');
  });
});