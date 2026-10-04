import {currentValueForToken} from './Current';
import {LITERAL_TOKEN_PREFIX} from './literalToken';
import {evaluateApiTest, resolveApiOutputField} from './apiTestEval';
import {exampleId, exampleTitle} from './APIData';
import {apiToYaml, exampleToApiTestBlock, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('apiParsePack example expect', () => {
  it('parses and packs example expect', () => {
    const yaml = [
      'type: api',
      'url: https://example.com',
      'outputs:',
      '  status_code: status',
      'examples:',
      '  - id: ok',
      '    title: Happy path',
      '    expect:',
      '      status_code: 200',
    ].join('\n');
    const api = yamlToAPIStrict(yaml);
    expect(api.examples?.[0]).toMatchObject({
      id: 'ok',
      title: 'Happy path',
      expect: {status_code: 200},
    });
    expect(exampleToApiTestBlock(api.examples?.[0])).toEqual({
      expect: {status_code: 200},
    });
    const packed = apiToYaml(api);
    expect(packed).toContain('id: ok');
    expect(packed).toContain('title: Happy path');
    expect(packed).toContain('expect:');
    expect(packed).not.toContain('require:');
    expect(packed).not.toContain('\ntest:');
    expect(yamlToAPI(packed).examples?.[0]?.expect).toEqual({status_code: 200});
  });

  it('rejects require on examples', () => {
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://example.com',
      'examples:',
      '  - id: ok',
      '    require:',
      '      status: 200',
    ].join('\n'))).toThrow(/unknown key\(s\) in examples #1: "require"/);
  });

  it('uses deprecated name as id/title fallback and rejects duplicate ids', () => {
    const api = yamlToAPI([
      'type: api',
      'url: https://x',
      'examples:',
      '  - name: legacy',
    ].join('\n'));
    expect(api.examples?.[0]?.name).toBe('legacy');
    expect(exampleId(api.examples?.[0])).toBe('legacy');
    expect(exampleTitle(api.examples?.[0])).toBe('legacy');
    expect(exampleToApiTestBlock(api.examples?.[0])).toBeUndefined();

    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'examples:',
      '  - id: dup',
      '  - name: dup',
    ].join('\n'))).toThrow(/duplicate example id/);
  });

  it('treats deprecated example outputs as soft expect and packs expect', () => {
    const api = yamlToAPI([
      'type: api',
      'url: https://x',
      'examples:',
      '  - id: legacy-out',
      '    outputs:',
      '      status: 200',
    ].join('\n'));
    expect(api.examples?.[0]?.outputs).toEqual({status: 200});
    expect(exampleToApiTestBlock(api.examples?.[0])).toEqual({
      expect: {status: 200},
    });
    const packed = apiToYaml(api);
    expect(packed).toContain('expect:');
    expect(packed).toContain('status: 200');
    expect(packed).not.toContain('outputs:');
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

  it('omits empty expect on pack', () => {
    const yaml = apiToYaml({
      type: 'api',
      url: 'https://example.com',
      examples: [{name: 'a', expect: {}}],
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

  it('resolves an i:username example expect from the inputs used', () => {
    const result = evaluateApiTest(
        {username: 'alice', quoted_angle: 'alice', quoted_curly: 'alice'},
        {expect: {
          username: 'i:username',
          quoted_angle: '<<i:username>>',
          quoted_curly: '{{i:username}}',
        }},
        {username: 'alice'},
    );
    expect(result.softFailed).toBe(false);
    expect(result.items.every(item => item.status === 'passed')).toBe(true);
    expect(result.items[0].expected).toBe('alice');
  });

  it('resolves an e: example expect from the environment, including text echoes', () => {
    const result = evaluateApiTest(
        {account_age: '42', feature_enabled: 'true', slice: 'https://'},
        {expect: {
          account_age: 'e:account_age',
          feature_enabled: 'e:feature_enabled',
          slice: 'e:service_url[0:8]',
        }},
        null,
        {account_age: 42, feature_enabled: true, service_url: 'https://test.mmt.dev'},
    );
    expect(result.softFailed).toBe(false);
    expect(result.items[0].expected).toBe(42);
    expect(result.items[2].expected).toBe('https://');
  });

  it('checks an r: example expect as the generator pattern', () => {
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const result = evaluateApiTest(
        {request_id: uuid, lucky_number: '15', active: true, literal_token: 'r:uuid'},
        {expect: {
          request_id: 'r:uuid',
          lucky_number: 'r:int(10,20)',
          active: 'r:bool',
          literal_token: LITERAL_TOKEN_PREFIX + 'r:uuid',
        }},
    );
    expect(result.items[0].status).toBe('passed');
    expect(result.items[0].comparison).toContain('=*');
    expect(result.items[1].status).toBe('passed');
    expect(result.items[2].status).toBe('passed');
    expect(result.items[3].status).toBe('passed');
    const low = evaluateApiTest(
        {lucky_number: 9},
        {expect: {lucky_number: '<<r:int(10,20)>>'}},
    );
    expect(low.softFailed).toBe(true);
  });

  it('resolves a c:day example expect to the same current day', () => {
    const day = currentValueForToken('day');
    const result = evaluateApiTest({quoted_angle: day, quoted_curly: day}, {
      expect: {quoted_angle: 'c:day', quoted_curly: '{{c:day}}'},
    });
    expect(result.softFailed).toBe(false);
    expect(result.items.every(item => item.status === 'passed')).toBe(true);
    expect(result.items[0].expected).toBe(day);
  });

  it('returns empty when test missing', () => {
    const result = evaluateApiTest({status: 200}, undefined);
    expect(result.hasChecks).toBe(false);
    expect(result.items).toEqual([]);
  });
});
