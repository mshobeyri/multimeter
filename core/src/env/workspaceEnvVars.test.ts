import {
  envVarStorageKey,
  isRuntimeEnvSource,
  resolveWorkspaceEnvMap,
} from './workspaceEnvVars';

describe('workspaceEnvVars', () => {
  it('detects runtime source', () => {
    expect(isRuntimeEnvSource('runtime')).toBe(true);
    expect(isRuntimeEnvSource('file')).toBe(false);
    expect(isRuntimeEnvSource(undefined)).toBe(false);
  });

  it('uses one environment-layer key for file and manual', () => {
    expect(envVarStorageKey('t', 'file')).toBe(envVarStorageKey('t', 'manual'));
    expect(envVarStorageKey('t', 'file')).not.toBe(envVarStorageKey('t', 'runtime'));
  });

  it('resolves runtime over environment', () => {
    expect(resolveWorkspaceEnvMap([
      {name: 'token', value: 'file', source: 'file'},
      {name: 'mode', value: 'dev', source: 'manual'},
      {name: 'token', value: 'rt', source: 'runtime'},
    ])).toEqual({token: 'rt', mode: 'dev'});
  });

  it('falls back when runtime is absent', () => {
    expect(resolveWorkspaceEnvMap([
      {name: 'token', value: 'file', source: 'file'},
    ])).toEqual({token: 'file'});
  });
});
