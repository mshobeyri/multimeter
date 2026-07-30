import {yamlToAPIStrict} from './apiParsePack';
import {parseExpectValue} from './JSerTestFlow';
import {
  applyOmitToOutgoingRequest,
  isOmitSentinel,
  normalizeOmitToNull,
  OMIT_SENTINEL,
  restoreOmitKeyword,
  restoreOmitKeywordInText,
  stripOmitFromBody,
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

  it('renames cleanly: the sentinel is the only marker used', () => {
    expect(OMIT_SENTINEL).toBe('__MMT_OMIT__');
    expect(restoreOmitKeywordInText(`{"a":"${OMIT_SENTINEL}"}`)).toBe('{"a":"omit"}');
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

describe('omit in a request built at runtime', () => {
  it('drops JSON body fields whose value came from an omitted input', () => {
    const body = JSON.stringify({message: OMIT_SENTINEL, keep: 'yes'}, null, 2);
    expect(JSON.parse(stripOmitFromBody(body, 'json'))).toEqual({keep: 'yes'});
  });

  it('keeps array index shape in JSON bodies', () => {
    const body = JSON.stringify({tags: [OMIT_SENTINEL, 'stable']});
    expect(JSON.parse(stripOmitFromBody(body, 'json'))).toEqual({
      tags: [null, 'stable'],
    });
  });

  it('drops urlencoded pairs', () => {
    expect(stripOmitFromBody(`a=1&message=${OMIT_SENTINEL}&b=2`, 'urlencoded'))
        .toBe('a=1&b=2');
  });

  it('drops XML elements and attributes', () => {
    const xml = `<root>\n  <keep>1</keep>\n  <message>${
        OMIT_SENTINEL}</message>\n  <item flag="${OMIT_SENTINEL}" other="2"/>\n</root>`;
    const stripped = stripOmitFromBody(xml, 'xml');
    expect(stripped).not.toContain(OMIT_SENTINEL);
    expect(stripped).not.toContain('<message>');
    expect(stripped).not.toContain('flag=');
    expect(stripped).toContain('<keep>1</keep>');
    expect(stripped).toContain('other="2"');
  });

  it('empties a text body that is only the marker', () => {
    expect(stripOmitFromBody(OMIT_SENTINEL, 'text')).toBe('');
  });

  it('leaves binary bodies untouched', () => {
    const buffer = Buffer.from([1, 2, 3]);
    expect(stripOmitFromBody(buffer, 'binary')).toBe(buffer);
  });

  it('leaves bodies without the marker untouched', () => {
    const body = '{"a": 1}';
    expect(stripOmitFromBody(body, 'json')).toBe(body);
  });

  it('drops omitted headers, query, and url query pairs', () => {
    const req = applyOmitToOutgoingRequest(
        {
          url: `https://example.com/items?limit=10&cursor=${OMIT_SENTINEL}`,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OMIT_SENTINEL}`,
          },
          query: {page: '2', filter: OMIT_SENTINEL},
          body: JSON.stringify({message: OMIT_SENTINEL}),
        },
        'json');

    expect(req.url).toBe('https://example.com/items?limit=10');
    expect(req.headers).toEqual({'Content-Type': 'application/json'});
    expect(req.query).toEqual({page: '2'});
    expect(JSON.parse(req.body)).toEqual({});
  });

  it('drops omitted gRPC message fields and metadata', () => {
    const req = applyOmitToOutgoingRequest({
      url: 'grpc://example.com',
      metadata: {'x-trace': OMIT_SENTINEL, keep: '1'},
      message: {name: OMIT_SENTINEL, id: 7},
    });

    expect(req.metadata).toEqual({keep: '1'});
    expect(req.message).toEqual({id: 7});
  });
});
