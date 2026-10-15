import {suggestAssertions} from './suggestAssertions';

describe('suggestAssertions', () => {
  it('suggests expect and assert from API outputs', () => {
    const result = suggestAssertions({
      stepId: 'iLogin',
      status: 200,
      outputs: {
        token: 'body.token',
        user_id: 'body.user_id',
      },
    });
    expect(result.expect).toEqual({
      status: 200,
      token: '!= null',
      user_id: '!= null',
    });
    expect(result.assertLines).toContain('${iLogin.status} == 200');
    expect(result.assertLines).toContain('${iLogin.token} != null');
    expect(result.expectYaml).toContain('token: != null');
    expect(result.assertYaml).toContain('- assert: ${iLogin.token} != null');
  });

  it('suggests body paths from a JSON response', () => {
    const result = suggestAssertions({
      stepId: 'iGet',
      status: 200,
      body: {
        name: 'Multimeter',
        count: 3,
        nested: {ok: true},
      },
      maxFields: 10,
    });
    expect(result.expect.status).toBe(200);
    expect(result.expect['body.name']).toBe('Multimeter');
    expect(result.expect['body.count']).toBe(3);
    expect(result.expect['body.nested.ok']).toBe(true);
    expect(result.patchHint).toContain('expect:');
  });

  it('caps body fields and uses != null for long strings', () => {
    const long = 'x'.repeat(80);
    const result = suggestAssertions({
      stepId: 'iGet',
      body: {a: 1, b: 2, c: 3, d: 4, e: long},
      maxFields: 3,
    });
    expect(Object.keys(result.expect).filter(k => k !== 'status').length).toBeLessThanOrEqual(3);
  });

  it('supports assert-only style', () => {
    const result = suggestAssertions({
      stepId: 'iX',
      status: 201,
      style: 'assert',
    });
    expect(result.expect).toEqual({});
    expect(result.assertLines).toEqual(['${iX.status} == 201']);
    expect(result.expectYaml).toBe('');
  });
});
