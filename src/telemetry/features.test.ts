import {analyzeMmtFeatures, withRuntimeInputs} from './features';

describe('analyzeMmtFeatures', () => {
  it('marks bare api as basic', () => {
    const flags = analyzeMmtFeatures(`
type: api
method: GET
url: https://example.com
`);
    expect(flags.fileType).toBe('api');
    expect(flags.protocol).toBe('http');
    expect(flags.complexity).toBe('basic');
    expect(flags.hasInputs).toBe(false);
    expect(flags.hasOutputs).toBe(false);
  });

  it('detects inputs outputs env and standard complexity', () => {
    const flags = analyzeMmtFeatures(`
type: api
protocol: graphql
inputs:
  id: "1"
outputs:
  name: body.data.name
headers:
  Accept: application/json
auth:
  type: bearer
  token: e:token
`);
    expect(flags.protocol).toBe('graphql');
    expect(flags.hasInputs).toBe(true);
    expect(flags.hasOutputs).toBe(true);
    expect(flags.hasHeaders).toBe(true);
    expect(flags.hasEnv).toBe(true);
    expect(flags.authKind).toBe('bearer');
    expect(flags.extractKind).toBe('jsonpath');
    expect(flags.complexity).toBe('standard');
  });

  it('detects test asserts imports and tokens', () => {
    const flags = analyzeMmtFeatures(`
type: test
import:
  api: +/api/echo.mmt
steps:
  - call: api.echo
    id: echo
    expect:
      status: 200
    check:
      ok: true
inputs:
  n: r:int
`);
    expect(flags.fileType).toBe('test');
    expect(flags.usesImport).toBe(true);
    expect(flags.usesExpect).toBe(true);
    expect(flags.usesCheck).toBe(true);
    expect(flags.usesRandom).toBe(true);
    expect(flags.hasInputs).toBe(true);
    expect(flags.complexity).toBe('standard');
    expect(flags.assertCountBucket).not.toBe('0');
  });

  it('promotes complexity when runtime inputs are provided', () => {
    const flags = withRuntimeInputs(
        analyzeMmtFeatures(`
type: api
method: GET
url: https://example.com
`),
        {q: '1'});
    expect(flags.hasInputs).toBe(true);
    expect(flags.complexity).toBe('standard');
  });
});
