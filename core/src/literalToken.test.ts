import {yamlToAPIStrict, apiToYaml} from './apiParsePack';
import {
  isLiteralTokenValue,
  isTokenLikeScalar,
  LITERAL_TOKEN_PREFIX,
  unwrapLiteralToken,
} from './literalToken';
import {replaceAllRefs, toTemplateValueJs} from './variableReplacer';
import {resolveApiRequest} from './resolveApiRequest';

describe('quoted token literals', () => {
  it('detects token-like whole scalars', () => {
    expect(isTokenLikeScalar('r:uuid')).toBe(true);
    expect(isTokenLikeScalar('i:user')).toBe(true);
    expect(isTokenLikeScalar('e:api_url')).toBe(true);
    expect(isTokenLikeScalar('<<c:date>>')).toBe(true);
    expect(isTokenLikeScalar('e:{token}')).toBe(true);
    expect(isTokenLikeScalar('{{r:uuid}}')).toBe(true);
    expect(isTokenLikeScalar('{{i:user}}')).toBe(true);
    expect(isTokenLikeScalar('hello')).toBe(false);
    expect(isTokenLikeScalar('d:nope')).toBe(false);
    expect(isTokenLikeScalar('{{var}}')).toBe(false);
  });

  it('parses quoted tokens as literals and bare tokens as resolvable', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: post
body:
  id: r:uuid
  literal: "r:uuid"
  input: i:user
  inputLiteral: "i:user"
  env: e:HOST
  envLiteral: "e:HOST"
`);
    const body = api.body as Record<string, unknown>;
    expect(body.id).toBe('r:uuid');
    expect(isLiteralTokenValue(body.literal)).toBe(true);
    expect(unwrapLiteralToken(String(body.literal))).toBe('r:uuid');
    expect(body.input).toBe('i:user');
    expect(isLiteralTokenValue(body.inputLiteral)).toBe(true);
    expect(isLiteralTokenValue(body.envLiteral)).toBe(true);
    expect(body.env).toBe('e:HOST');
  });

  it('normalizes YAML curly aliases {{…}} to bare / <<>> on parse', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: post
headers:
  Authorization: Bearer {{e:token}}
body:
  id: {{r:uuid}}
  n: {{r:int}}
  user: {{i:name}}
  mixed: hello {{e:env}}
`);
    expect(api.headers?.Authorization).toBe('Bearer <<e:token>>');
    const body = api.body as Record<string, unknown>;
    expect(body.id).toBe('r:uuid');
    expect(body.n).toBe('r:int');
    expect(body.user).toBe('i:name');
    expect(body.mixed).toBe('hello <<e:env>>');
  });

  it('keeps quoted curly aliases as literal text', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: get
body:
  literal: "{{r:uuid}}"
`);
    const body = api.body as Record<string, unknown>;
    expect(isLiteralTokenValue(body.literal)).toBe(true);
    expect(unwrapLiteralToken(String(body.literal))).toBe('{{r:uuid}}');
  });

  it('keeps quoted tokens as text when resolving', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: post
body:
  id: r:uuid
  literal: "r:uuid"
`);
    const resolved = resolveApiRequest(
        api, {}, {}, {refreshRuntimeTokens: true, preserveStructuredBody: true});
    const body = resolved.body as Record<string, unknown>;
    expect(body.id).not.toBe('r:uuid');
    expect(body.literal).toBe('r:uuid');
  });

  it('round-trips quoted tokens back to quoted YAML', () => {
    const api = yamlToAPIStrict(`
type: api
url: https://example.com
method: post
body:
  literal: "r:uuid"
  plain: r:uuid
`);
    const yaml = apiToYaml(api as any);
    expect(yaml).toMatch(/literal:\s*"r:uuid"/);
    expect(yaml).not.toContain(LITERAL_TOKEN_PREFIX);
    expect(yaml).toMatch(/plain:\s*r:uuid/);
  });

  it('codegen emits JSON string for quoted token literals', () => {
    const wrapped = `${LITERAL_TOKEN_PREFIX}r:uuid`;
    expect(toTemplateValueJs(wrapped)).toBe(JSON.stringify('r:uuid'));
    const kept = replaceAllRefs(
        {id: wrapped},
        {},
        {},
        {},
        new Set(),
        {resolveRuntimeTokens: false},
    );
    expect(isLiteralTokenValue(kept.id)).toBe(true);
  });
});
