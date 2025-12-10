import {ApiLogRawValue, createApiLogHelpers, prepareRunFromOptions, RunFileOptions} from './runner';
import path from 'path';

const baseOptions = (overrides: Partial<RunFileOptions> = {}): RunFileOptions => ({
  file: '',
  fileType: 'raw',
  filePath: overrides.filePath || path.join(process.cwd(), 'temp.mmt'),
  manualInputs: {},
  envvar: {},
  manualEnvvars: {},
  fileLoader: async () => '',
  runCode: async () => {},
  ...overrides,
});

const API_DOC = `
type: api
title: Example API
url: http://example.com/api
method: get
protocol: http
inputs:
  username: defaultUser
  password: defaultPass
examples:
  - name: primary
    inputs:
      username: firstUser
      password: firstPass
  - name: override
    inputs:
      username: secondUser
      password: secondPass
`;

const TEST_DOC = `
type: test
title: Demo Test
inputs:
  region: us-east
steps:
  - print: "done"
`;

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
`REQUEST\n  method:    GET\n  headers:\n    {\n      Accept:  "json"\n    }\n  duration:  125 ms`
    );
  });

  it('formats nested values with indentation', () => {
    const helpers = createApiLogHelpers();

    const value = helpers.formatValue({alpha: 'beta', nested: [1, {two: 2}]}, 2);
    expect(value).toBe(
`  {\n    alpha:   "beta"\n    nested:\n      [\n        1\n        {\n          two:  2\n        }\n      ]\n  }`
    );
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

describe('prepareRunFromOptions', () => {
  it('selects API examples by exampleId from manual inputs', async () => {
    const prepared = await prepareRunFromOptions(baseOptions({
      file: API_DOC,
      manualInputs: {exampleId: 'override'},
    }));

    expect(prepared.docType).toBe('api');
    expect(prepared.exampleName).toBe('override');
    expect(prepared.inputsUsed).toEqual({
      username: 'secondUser',
      password: 'secondPass',
    });
  });

  it('applies manual input overrides after example inputs', async () => {
    const prepared = await prepareRunFromOptions(baseOptions({
      file: API_DOC,
      exampleIndex: 0,
      manualInputs: {password: 'manualPass'},
    }));

    expect(prepared.inputsUsed).toEqual({
      username: 'firstUser',
      password: 'manualPass',
    });
    expect(prepared.exampleIndex).toBe(0);
  });

  it('merges manual environment variables over base env', async () => {
    const prepared = await prepareRunFromOptions(baseOptions({
      file: API_DOC,
      envvar: {token: 'base', region: 'us'},
      manualEnvvars: {token: 'manual', stage: 'beta'},
    }));

    expect(prepared.envVarsUsed).toEqual({token: 'manual', region: 'us', stage: 'beta'});
  });

  it('supports test documents and merges manual inputs', async () => {
    const prepared = await prepareRunFromOptions(baseOptions({
      file: TEST_DOC,
      filePath: '/tmp/demo-test.mmt',
      manualInputs: {region: 'eu-west', user: 'alice'},
    }));

    expect(prepared.docType).toBe('test');
    expect(prepared.inputsUsed).toEqual({region: 'eu-west', user: 'alice'});
    expect(prepared.exampleName).toBeUndefined();
  });
});
