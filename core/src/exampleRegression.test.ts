import * as YAML from 'yaml';
import {quoteExpectOperators} from './expectOperatorYaml';
import {httpToTest} from './httpParsePack';
import {rootTestToJsfunc, testToJsfunc} from './JSer';
import {checkToJSfunc, parseExpectValue} from './JSerTestFlow';
import {OMIT_SENTINEL} from './omitKeyword';
import {yamlToTest} from './testParsePack';

// CLI uses js-yaml (no types in core). Exercise the same parser here.
const jsyaml = require('js-yaml') as {
  load: (input: string) => unknown;
};

/**
 * Regressions found while running examples under testlight after YAML-typed
 * expect/condition sides and CLI operator quoting.
 */
describe('example scenario regressions', () => {
  describe('CLI-safe YAML (quoteExpectOperators)', () => {
    it('quotes != null so js-yaml can load chained-style expects', () => {
      const raw = [
        'type: test',
        'steps:',
        '  - call: login',
        '    expect:',
        '      token: != null',
        '      name: != null',
      ].join('\n');

      expect(() => jsyaml.load(raw)).toThrow(/unknown tag/i);

      const prepared = quoteExpectOperators(raw);
      expect(prepared).toContain('token: "!= null"');
      const doc = jsyaml.load(prepared) as any;
      expect(doc.steps[0].expect.token).toBe('!= null');
      expect(YAML.parse(prepared).steps[0].expect.name).toBe('!= null');
    });

    it('quotes >60% fuzzy expects like operators_test', () => {
      const raw = [
        'type: test',
        'steps:',
        '  - call: sample',
        '    expect:',
        '      message: >60% Hello world from MMT',
        '      score:',
        '        - ">= 80"',
        '        - <= 90',
      ].join('\n');

      expect(() => jsyaml.load(raw)).toThrow();

      const prepared = quoteExpectOperators(raw);
      expect(prepared).toContain('message: ">60% Hello world from MMT"');
      const doc = jsyaml.load(prepared) as any;
      expect(doc.steps[0].expect.message).toBe('>60% Hello world from MMT');
      expect(doc.steps[0].expect.score).toEqual(['>= 80', '<= 90']);
    });
  });

  describe('expect codegen from real YAML', () => {
    it('emits numeric status equals for == 200 (imports/http failure mode)', async () => {
      const test = yamlToTest([
        'type: test',
        'steps:',
        '  - call: login',
        '    expect:',
        '      status_code: == 200',
        '      token: != null',
      ].join('\n'));

      const js = await testToJsfunc(
          {name: 'statusNumeric', test, inputs: {}, envVars: {}}, true);
      expect(js).toContain('equals_(_login_0.status_code, 200)');
      expect(js).not.toContain('equals_(_login_0.status_code, `200`)');
      expect(js).toContain('isNotOmitted_(_login_0.token)');
    });

    it('emits string status equals only when quoted', async () => {
      const test = yamlToTest([
        'type: test',
        'steps:',
        '  - call: login',
        '    expect:',
        '      status_code: == "200"',
      ].join('\n'));

      const js = await testToJsfunc(
          {name: 'statusString', test, inputs: {}, envVars: {}}, true);
      expect(js).toContain('equals_(_login_0.status_code, `200`)');
    });

    it('keeps YAML-quoted omit/null as string expects (omit example)', async () => {
      const test = yamlToTest([
        'type: test',
        'steps:',
        '  - call: profile',
        '    expect:',
        '      echoed_middle_name: omit',
        '      echoed_nickname: "omit"',
        '      echoed_bio: null',
        '      echoed_bio_text: "null"',
      ].join('\n'));

      const expectMap = (test.steps?.[0] as any).expect;
      expect(expectMap.echoed_middle_name).toBe(OMIT_SENTINEL);
      expect(expectMap.echoed_nickname).toBe('omit');
      expect(expectMap.echoed_bio).toBeNull();
      expect(expectMap.echoed_bio_text).toBe('null');

      expect(parseExpectValue(expectMap.echoed_nickname)).toEqual({
        operator: '==',
        expected: 'omit',
      });
      expect(parseExpectValue(expectMap.echoed_bio_text)).toEqual({
        operator: '==',
        expected: 'null',
      });

      const js = await testToJsfunc(
          {name: 'omitExpect', test, inputs: {}, envVars: {}}, true);
      expect(js).toContain('isOmitted_(_profile_0.echoed_middle_name)');
      expect(js).toContain('equals_(_profile_0.echoed_nickname, `omit`)');
      expect(js).toContain('equals_(_profile_0.echoed_bio_text, `null`)');
    });

    it('types check condition sides like stages_test', () => {
      const js = checkToJSfunc('${doLogin.status_code} == 200', false);
      expect(js).toContain('equals_(doLogin.status_code, 200)');
      expect(js).not.toContain('`200`');
    });
  });

  describe('HTTP assert quote preservation', () => {
    it('keeps === "1" as a quoted string expect (query echo case)', () => {
      const test = httpToTest(`
@baseUrl = https://test.mmt.dev

GET {{baseUrl}}/echo?userId=1

> {%
  client.test("User id in query", function () {
    client.assert(response.body.query.userId === "1");
  });

  client.test("Status", function () {
    client.assert(response.status === 200);
  });
%}
`);
      expect(test.steps?.[0]).toMatchObject({
        expect: {
          'body.query.userId': '== "1"',
          status: '== 200',
        },
      });
      expect(parseExpectValue('== "1"')).toEqual({operator: '==', expected: '1'});
      expect(parseExpectValue('== 200')).toEqual({operator: '==', expected: 200});
    });
  });

  describe('hoisted ids + o: outputs (chained style)', () => {
    it('generates high-scope id and o: set/read', async () => {
      const js = await rootTestToJsfunc({
        name: 'chainedStyle',
        test: {
          title: 'chained',
          tags: [],
          description: '',
          outputs: {session_token: '', user_id: ''},
          steps: [
            {call: 'login', id: 'auth', expect: {token: '!= null'}} as any,
            {
              set: {
                'o:session_token': '${auth.token}',
                'o:user_id': '${auth.user_id}',
              },
            } as any,
            {
              call: 'getProfile',
              inputs: {token: 'o:session_token', user_id: 'o:user_id'},
              expect: {name: '!= null'},
            } as any,
          ],
        } as any,
        inputs: {},
        envVars: {},
      });
      expect(js).toContain('let auth;');
      expect(js).toContain('auth = await login(');
      expect(js).toContain('outputs.session_token');
      expect(js).toContain('outputs.user_id');
      expect(js).toContain('isNotOmitted_(auth.token)');
      expect(js).toMatch(/outputs\.session_token/);
    });
  });
});
