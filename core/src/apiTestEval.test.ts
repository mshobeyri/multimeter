import {evaluateApiTest, resolveApiOutputField} from './apiTestEval';
import {apiToYaml, exampleToApiTestBlock, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('apiParsePack example expect/require', () => {
  it('parses and packs example expect / require', () => {
    const yaml = [
      'type: api',
      'url: https://example.com',
      'outputs:',
      '  status_code: status',
      'examples:',
      '  - name: ok',
      '    expect:',
      '      status_code: 200',
      '    require:',
      '      status_code: == 200',
    ].join('\n');
    const api = yamlToAPIStrict(yaml);
    expect(api.examples?.[0]).toMatchObject({
      name: 'ok',
      expect: {status_code: 200},
      require: {status_code: '== 200'},
    });
    expect(exampleToApiTestBlock(api.examples?.[0])).toEqual({
      expect: {status_code: 200},
      require: {status_code: '== 200'},
    });
    const packed = apiToYaml(api);
    expect(packed).toContain('expect:');
    expect(packed).toContain('require:');
    expect(packed).not.toContain('\ntest:');
    expect(yamlToAPI(packed).examples?.[0]?.expect).toEqual({status_code: 200});
  });

  it('rejects root-level test key', () => {
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'test:',
      '  expect:',
      '    status: 200',
    ].join('\n'))).toThrow(/unknown key/);
  });

  it('omits empty expect/require on pack', () => {
    const yaml = apiToYaml({
      type: 'api',
      url: 'https://example.com',
      examples: [{name: 'a', expect: {}, require: {}}],
    } as any);
    expect(yaml).toContain('name: a');
    expect(yaml).not.toContain('expect:');
    expect(yaml).not.toContain('require:');
  });
});

describe('evaluateApiTest', () => {
  it('evaluates soft and hard checks against outputs', () => {
    const outputs = {
      status_code: 200,
      _: {status: 200, body: {ok: true}},
      body: {ok: true},
    };
    const result = evaluateApiTest(outputs, {
      expect: {status_code: 200, 'body.ok': true},
      require: {status_code: '== 200'},
    });
    expect(result.hasChecks).toBe(true);
    expect(result.hardFailed).toBe(false);
    expect(result.softFailed).toBe(false);
    expect(result.items.every(i => i.status === 'passed')).toBe(true);
  });

  it('marks require failures as hardFailed', () => {
    const result = evaluateApiTest({status: 500, _: {status: 500}}, {
      expect: {status: 200},
      require: {status: '== 200'},
    });
    expect(result.softFailed).toBe(true);
    expect(result.hardFailed).toBe(true);
    expect(result.items.filter(i => i.level === 'require')[0].status).toBe('failed');
  });

  it('resolves default output roots via _ fallback', () => {
    expect(resolveApiOutputField({_: {status: 201}}, 'status')).toBe(201);
    expect(resolveApiOutputField({status: 200, _: {status: 201}}, 'status')).toBe(200);
    expect(resolveApiOutputField({_: {body: {id: 1}}}, 'body.id')).toBe(1);
  });

  it('returns empty when test missing', () => {
    const result = evaluateApiTest({status: 200}, undefined);
    expect(result.hasChecks).toBe(false);
    expect(result.items).toEqual([]);
  });
});
