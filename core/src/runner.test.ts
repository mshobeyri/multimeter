import {OMIT_SENTINEL} from './omitKeyword';
import {yamlToAPI} from './apiParsePack';
import {CREATE_API_LOG_HELPERS_SOURCE} from './apiLogHelpersFactorySource';
import {ApiLogRawValue, createApiLogHelpers, generateApiJs} from './runApi';

describe('createApiLogHelpers', () => {
  it('keeps baked factory source in sync for pkg embedding', () => {
    const live = Function.prototype.toString.call(createApiLogHelpers);
    // Under normal Node the live source must match the baked string so pkg
    // binaries and CLI stay aligned. Collapse whitespace for a stable compare.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(CREATE_API_LOG_HELPERS_SOURCE)).toBe(normalize(live));
    expect(CREATE_API_LOG_HELPERS_SOURCE).not.toMatch(/\{\s*\[native code\]\s*\}/);
    // Must be valid JS for new Function (same path as generated API runners).
    expect(() => new Function(CREATE_API_LOG_HELPERS_SOURCE)).not.toThrow();
  });

  it('embeds baked helpers into API JS even if toString is native', async () => {
    const original = Function.prototype.toString;
    Function.prototype.toString = function(this: Function) {
      if (this === createApiLogHelpers) {
        return 'function createApiLogHelpers() { [native code] }';
      }
      return original.call(this);
    };
    try {
      const rawText = [
        'type: api',
        'title: Echo',
        'url: https://example.com',
        'method: get',
      ].join('\n');
      const api = yamlToAPI(rawText);
      const js = await generateApiJs({
        api,
        name: 'echo',
        inputs: {},
        envVars: {},
        fileLoader: async () => '',
      });
      expect(js).not.toMatch(/\{\s*\[native code\]\s*\}/);
      expect(js).toContain('function createApiLogHelpers()');
      expect(js).toContain('omitSentinel');
      expect(() => new Function(js)).not.toThrow();
    } finally {
      Function.prototype.toString = original;
    }
  });

  it('prints a missing output as the omit keyword', () => {
    const helpers = createApiLogHelpers();

    // The helpers are serialized into generated code and cannot import the
    // constant, so this also guards their inlined copy of the marker.
    expect(helpers.formatSection('Outputs:', {
      found: 'yes',
      missing: OMIT_SENTINEL,
      literal: 'omit',
    })).toBe('Outputs:\n  found:    "yes"\n  missing:  omit\n  literal:  "omit"');
  });

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
        {s: 'ok', ss: 12, d: '__MMT_OMIT__'},
        {s: 'ok', ss: 13, d: '__MMT_OMIT__'}, 'Echo API');
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
