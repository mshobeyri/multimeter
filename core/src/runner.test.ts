import {OMIT_SENTINEL} from './omitKeyword';
import {yamlToAPI} from './apiParsePack';
import {CREATE_API_LOG_HELPERS_SOURCE} from './apiLogHelpersFactorySource';
import {ApiLogRawValue, createApiLogHelpers, executeApi, generateApiJs, prepareApiRun, resolveApiExample} from './runApi';

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

  it('formats empty collections, bigint, Buffer, and match edge cases', () => {
    const helpers = createApiLogHelpers();
    expect(helpers.formatScalar(null)).toBe('null');
    expect(helpers.formatScalar(BigInt(1))).toBe('1');
    expect(helpers.formatScalar(Symbol('x'))).toContain('Symbol');
    expect(helpers.formatScalar(Number.POSITIVE_INFINITY)).toBe('"Infinity"');
    expect(helpers.formatValue([], 0)).toBe('[]');
    expect(helpers.formatValue({}, 0)).toBe('{}');
    expect(helpers.formatKeyValueObject({})).toContain('{}');
    expect(helpers.formatDuration(-5)).toEqual({__mmt_raw: '0ms'});
    expect(helpers.formatBodyValue(Buffer.from('hi'))).toBe('<binary 2 bytes>');
    expect(helpers.valuesMatch(undefined, 1)).toBe(false);
    expect(helpers.valuesMatch(null, null)).toBe(true);
    expect(helpers.valuesMatch(null, 1)).toBe(false);
    expect(helpers.valuesMatch({a: BigInt(1)}, {a: BigInt(1)})).toBe(false);
    expect(helpers.formatExpects(
        {obj: {a: 1}, miss: undefined},
        {obj: {a: 1}, miss: {nested: '__MMT_OMIT__'}},
        null as any).successLines.length).toBe(1);
  });
});

describe('resolveApiExample and prepareApiRun', () => {
  const api = {
    type: 'api',
    title: 'Echo',
    inputs: {a: 1},
    examples: [
      {name: 'Happy', inputs: {a: 2}, outputs: {status: 200}},
      {inputs: {a: 3}},
    ],
  } as any;

  it('resolves by name, index, and falls back with warnings', () => {
    const warns: string[] = [];
    const log = (_l: string, m: string) => warns.push(m);
    expect(resolveApiExample({type: 'api'} as any, 0, undefined, log).exampleInputs).toEqual({});
    const byName = resolveApiExample(api, undefined, 'happy', log);
    expect(byName.exampleInputs).toEqual({a: 2});
    expect(byName.resolvedExampleName).toBe('Happy');
    const byIndex = resolveApiExample(api, 1, undefined, log);
    expect(byIndex.exampleInputs).toEqual({a: 3});
    resolveApiExample(api, undefined, 'missing', log);
    resolveApiExample(api, 9, undefined, log);
    expect(warns.some(w => w.includes('missing'))).toBe(true);
    expect(warns.some(w => w.includes('#10'))).toBe(true);
  });

  it('merges example inputs in prepareApiRun', () => {
    const raw = [
      'type: api',
      'title: Echo',
      'url: https://example.com',
      'method: get',
      'inputs:',
      '  a: 1',
      'examples:',
      '  - name: Happy',
      '    inputs:',
      '      a: 2',
      '    outputs:',
      '      status: 200',
    ].join('\n');
    const prepared = prepareApiRun(raw, {b: 9}, {exampleName: 'Happy'}, () => {});
    expect(prepared.exampleName).toBe('Happy');
    expect(prepared.inputsUsed).toMatchObject({a: 2, b: 9});
    expect(prepared.exampleOutputs).toEqual({status: 200});
  });
});

describe('executeApi', () => {
  it('throws when apiDoc is missing and runs a generated wrapper with failures', async () => {
    await expect(executeApi({} as any, {
      fileLoader: async () => '',
      jsRunner: async () => {},
      logger: () => {},
    } as any, [])).rejects.toThrow('API document not found');

    const raw = [
      'type: api',
      'title: Echo',
      'url: https://example.com',
      'method: get',
    ].join('\n');
    const prepared = {
      docType: 'api' as const,
      baseName: 'echo.mmt',
      title: 'Echo',
      envVarsUsed: {TOKEN: 'abc'},
      inputsUsed: {q: 1},
      apiDoc: yamlToAPI(raw),
      exampleName: 'Happy',
      exampleIndex: 0,
      exampleOutputs: {status: 200},
      filePath: '/tmp/echo.mmt',
    };
    const logs: string[] = [];
    const result = await executeApi(prepared as any, {
      fileLoader: async () => { throw new Error('no file'); },
      jsRunner: async (ctx: any) => {
        ctx.logger('error', 'wrapper failed');
        throw new Error('send failed');
      },
      logger: (_l: string, m: string) => logs.push(m),
      binaryFileLoader: async () => Buffer.from([]),
    } as any, [{level: 'warn', message: 'pre'}]);
    expect(result.displayName).toContain('Happy');
    expect(result.result.logs?.some((l: string) => l === 'pre')).toBe(true);
  });
});
