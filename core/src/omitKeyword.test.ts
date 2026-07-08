import {yamlToAPIStrict} from './apiParsePack';
import {parseExpectValue} from './JSerTestFlow';
import {
  isOmitSentinel,
  normalizeOmitToNull,
  OMIT_SENTINEL,
  restoreOmitKeyword,
  stripOmitFromRequest,
} from './omitKeyword';
import {yamlToTestStrict} from './testParsePack';
import {replaceAllRefs} from './variableReplacer';
import {apiToYaml} from './apiParsePack';

describe('omit keyword parsing', () => {
  it('parses unquoted omit as sentinel and keeps quoted omit as string', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: post
inputs:
  removeMe: omit
  keepLiteral: "omit"
`);
    expect(isOmitSentinel(api.inputs?.removeMe)).toBe(true);
    expect(api.inputs?.keepLiteral).toBe('omit');
  });

  it('supports omit keyword in call inputs and quoted literal in test files', () => {
    const test = yamlToTestStrict(`
type: test
import:
  login: ./login.mmt
steps:
  - call: login
    inputs:
      token: omit
      literal: "omit"
`);
    const callInputs = (test.steps?.[0] as any).inputs;
    expect(isOmitSentinel(callInputs.token)).toBe(true);
    expect(callInputs.literal).toBe('omit');
  });
});

describe('omit keyword transformations', () => {
  it('removes object fields for request payloads and keeps array shape', () => {
    const request = {
      headers: {
        'X-Trace': OMIT_SENTINEL,
        'Content-Type': 'application/json',
      },
      body: {
        user: {
          email: 'x@example.com',
          nickname: OMIT_SENTINEL,
        },
        tags: [OMIT_SENTINEL, 'stable'],
      },
    };
    expect(stripOmitFromRequest(request)).toEqual({
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        user: {
          email: 'x@example.com',
        },
        tags: [null, 'stable'],
      },
    });
  });

  it('normalizes omit sentinel to null for output expectations', () => {
    const parsed = parseExpectValue(OMIT_SENTINEL as any);
    expect(parsed).toEqual({operator: '==', expected: null});
    expect(normalizeOmitToNull({a: OMIT_SENTINEL, b: ['x', OMIT_SENTINEL]})).toEqual({
      a: null,
      b: ['x', null],
    });
  });

  it('restores sentinel back to omit when serializing yaml', () => {
    expect(restoreOmitKeyword({inputs: {username: OMIT_SENTINEL}})).toEqual({
      inputs: {username: 'omit'},
    });

    const yaml = apiToYaml({
      type: 'api',
      title: 'x',
      url: 'https://example.com',
      inputs: {username: OMIT_SENTINEL},
    } as any);
    expect(yaml).toContain('username: omit');
    expect(yaml).not.toContain(OMIT_SENTINEL);
  });

  it('keeps literal omit/null strings quoted when serializing yaml', () => {
    const yaml = apiToYaml({
      type: 'api',
      title: 'quoted literals',
      url: 'https://example.com',
      inputs: {
        asKeyword: OMIT_SENTINEL,
        asString: 'omit',
        nullAsString: 'null',
      },
    } as any);

    expect(yaml).toContain('asKeyword: omit');
    expect(yaml).toContain('asString: \"omit\"');
    expect(yaml).toContain('nullAsString: \"null\"');

    const parsed = yamlToAPIStrict(yaml);
    expect(isOmitSentinel(parsed.inputs?.asKeyword)).toBe(true);
    expect(parsed.inputs?.asString).toBe('omit');
    expect(parsed.inputs?.nullAsString).toBe('null');
  });

  it('removes all fields derived from omitted input values', () => {
    const replaced = replaceAllRefs(
        {
          body: {
            username: 'i:username',
            role: 'i:role',
            user_initial: '<<i:username[0]>>',
            role_short: '<<i:role[0:3]>>',
          },
        },
        {username: OMIT_SENTINEL, role: 'admin'} as any,
        {},
        {},
    );
    const cleaned = stripOmitFromRequest(replaced);
    expect(cleaned.body).toEqual({
      role: 'admin',
      role_short: 'adm',
    });
  });
});
