import * as runConfig from './runConfig';

describe('runConfig helpers', () => {
  it('merges inputs with correct priority', () => {
    const merged = runConfig.mergeInputs({
      defaultInputs: {a: 1, shared: 'def'},
      exampleInputs: {b: 2, shared: 'ex'},
      manualInputs: {c: 3, shared: 'man'},
    });
    expect(merged).toEqual({a: 1, b: 2, c: 3, shared: 'man'});
  });

  it('merges env with correct priority', () => {
    const merged = runConfig.mergeEnv({
      baseEnv: {a: 1, shared: 'base'},
      envvar: {b: 2, shared: 'env'},
      presetEnv: {c: 3, shared: 'preset'},
      manualEnvvars: {d: 4, shared: 'man'},
    });
    expect(merged).toEqual({a: 1, b: 2, c: 3, d: 4, shared: 'man'});
  });

  it('selectFromVariables maps named choices and falls back', () => {
    const variables = {
      region: {dev: 'us-dev', prod: 'us-prod'},
      mode: ['debug', 'release'],
      scalar: 'x',
    };
    expect(runConfig.selectFromVariables(variables, 'region', 'dev')).toBe('us-dev');
    expect(runConfig.selectFromVariables(variables, 'region', 'custom')).toBe('us-dev');
    expect(runConfig.selectFromVariables(variables, 'mode', 'debug')).toBe('debug');
    expect(runConfig.selectFromVariables(variables, 'mode', 'invalid')).toBe('debug');
    expect(runConfig.selectFromVariables(variables, 'scalar', 'y')).toBe('y');
    expect(runConfig.selectFromVariables(variables, 'missing', 'z')).toBe('z');
  });

  it('resolvePresetEnv resolves runner and group.name presets', () => {
    const doc = {
      variables: {region: {dev: 'us-dev', prod: 'us-prod'}},
      presets: {
        runner: {dev: {region: 'dev'}},
        custom: {prod: {region: 'prod'}},
      },
    };
    expect(runConfig.resolvePresetEnv(doc, undefined)).toEqual({});
    expect(runConfig.resolvePresetEnv(doc, 'missing')).toEqual({});
    expect(runConfig.resolvePresetEnv(doc, 'dev')).toEqual({region: 'us-dev'});
    expect(runConfig.resolvePresetEnv(doc, 'custom.prod')).toEqual({region: 'us-prod'});
  });

  // Note: resolveEnvFromDoc is covered by CLI/assistant integration tests.
});
