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
        `REQUEST\n  method:    GET\n  headers:\n    {\n      Accept:  "json"\n    }\n  duration:  125 ms`);
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

    expect(formatted).toEqual({__mmt_raw: '321 ms'});
    expect(blank).toEqual({__mmt_raw: ''});
  });
});