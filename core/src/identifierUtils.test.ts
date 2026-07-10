import {applyRunDebugToRequestSteps, safeStepId, safeStepIdFromAlias, slugToCamel} from './identifierUtils';

describe('identifierUtils', () => {
  it('keeps safe camel aliases unchanged', () => {
    expect(slugToCamel('Create user')).toBe('createUser');
  });

  it('does not rename import aliases that match test-flow keywords', () => {
    expect(slugToCamel('call')).toBe('call');
    expect(slugToCamel('default')).toBe('default');
  });

  it('always prefixes step ids derived from import aliases', () => {
    expect(safeStepIdFromAlias('ping')).toBe('iPing');
    expect(safeStepIdFromAlias('call')).toBe('iCall');
    expect(safeStepIdFromAlias('createUser')).toBe('iCreateUser');
  });

  it('prefixes only standalone step ids that conflict with generated JS bindings', () => {
    expect(safeStepId('call')).toBe('iCall');
    expect(safeStepId('default')).toBe('iDefault');
    expect(safeStepId('login')).toBe('login');
    expect(safeStepId('createUser')).toBe('createUser');
  });

  it('adds debug to http request steps only', () => {
    const steps = applyRunDebugToRequestSteps([
      {http: 'https://test.mmt.dev/json', method: 'get'} as any,
      {setenv: {token: 'body.id'}} as any,
    ]);
    expect(steps[0]).toMatchObject({debug: true});
    expect(steps[1]).toEqual({setenv: {token: 'body.id'}});
  });
});
