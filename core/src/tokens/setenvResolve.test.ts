import {
  buildSetenvExtractRules,
  findLegacySetenvOutputRefs,
  isLegacySetenvOutputRef,
  resolveSetenvValues,
} from './setenvResolve';

describe('setenvResolve', () => {
  const response = {
    type: 'json' as const,
    body: JSON.stringify({access_token: 'abc', user: {id: 7}}),
    headers: {},
    cookies: {},
    status: 200,
    duration: 12,
  };

  it('detects legacy output-key refs', () => {
    const outputs = {token: 'body.access_token'};
    expect(isLegacySetenvOutputRef('token', outputs)).toBe(true);
    expect(isLegacySetenvOutputRef('body.access_token', outputs)).toBe(false);
    expect(isLegacySetenvOutputRef('missing', outputs)).toBe(false);
  });

  it('builds extract rules rewriting legacy refs to output expressions', () => {
    const rules = buildSetenvExtractRules(
        {
          TOKEN: 'token',
          USER_ID: 'body.user.id',
        },
        {token: 'body.access_token'});
    expect(rules).toEqual({
      TOKEN: 'body.access_token',
      USER_ID: 'body.user.id',
    });
  });

  it('lists legacy refs for deprecation UI', () => {
    expect(findLegacySetenvOutputRefs(
               {TOKEN: 'token', X: 'body.x'}, {token: 'body.access_token'}))
        .toEqual([{
          envKey: 'TOKEN',
          outputKey: 'token',
          expression: 'body.access_token',
        }]);
  });

  it('resolves setenv from extraction expressions', () => {
    const resolved = resolveSetenvValues({
      response,
      setenv: {
        TOKEN: 'body.access_token',
        USER_ID: 'body.user.id',
      },
    });
    expect(resolved).toEqual([
      {name: 'TOKEN', value: 'abc'},
      {name: 'USER_ID', value: 7},
    ]);
  });

  it('resolves legacy output-key refs via extracted outputs', () => {
    const outputs = {token: 'body.access_token'};
    const extractedOutputs = {token: 'abc'};
    const resolved = resolveSetenvValues({
      response,
      setenv: {TOKEN: 'token'},
      outputs,
      extractedOutputs,
    });
    expect(resolved).toEqual([{name: 'TOKEN', value: 'abc'}]);
  });

  it('skips empty or missing extractions', () => {
    const resolved = resolveSetenvValues({
      response,
      setenv: {MISSING: 'body.nope'},
    });
    expect(resolved).toEqual([]);
  });
});
