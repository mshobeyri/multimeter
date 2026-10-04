import {yamlToAPIStrict, apiToYaml, yamlToAPI} from './apiParsePack';
import {requestForSend} from './apiBodyEdit';
import {apiToJSfunc} from './JSerAPI';
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
    expect(isTokenLikeScalar('e:{token}')).toBe(false);
    expect(isTokenLikeScalar('<e:token>')).toBe(false);
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
    expect(isLiteralTokenValue(body.literal)).toBe(true);
    expect(unwrapLiteralToken(String(body.literal))).toBe('r:uuid');
  });

  it('sends a resolved request with quoted tokens still as text', async () => {
    const api = yamlToAPI([
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'inputs:',
      '  username: alice',
      '  age: 100',
      'body:',
      '  name: i:username',
      '  years: i:age',
      '  quotedName: "i:username"',
      '  quotedAge: "i:age"',
      '  quotedMissing: "e:xxx"',
      '  quotedRandom: "r:uuid"',
    ].join('\n'));
    const resolved = resolveApiRequest(
        api, {}, {}, {refreshRuntimeTokens: true, preserveStructuredBody: true});
    const sent = String(requestForSend(resolved, 'json').body);
    expect(sent).toContain('"name":"alice"');
    expect(sent).toContain('"years":100');
    expect(sent).toContain('"quotedName":"i:username"');
    expect(sent).toContain('"quotedAge":"i:age"');
    expect(sent).toContain('"quotedMissing":"e:xxx"');
    expect(sent).toContain('"quotedRandom":"r:uuid"');
    expect(sent).not.toContain('{{');
    expect(sent).not.toContain('<<');

    const resent = yamlToAPI([
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'inputs:',
      '  username: alice',
      '  age: 100',
      'body: |',
      ...sent.split('\n').map(line => `  ${line}`),
    ].join('\n'));
    const js = await apiToJSfunc({
      api: resent, name: 'echo', inputs: {}, envVars: {},
    });
    expect(js).toContain('"quotedName":"i:username"');
    expect(js).toContain('"quotedAge":"i:age"');
    expect(js).toContain('"quotedMissing":"e:xxx"');
    expect(js).toContain('"quotedRandom":"r:uuid"');
    expect(js).not.toContain('quotedName":"${username}"');
    expect(js).not.toContain('<<${mmtRandom_');
    expect(js).not.toContain('<${mmtEnv_');
  });

  it('sends missing bare body tokens as plain text', async () => {
    const api = yamlToAPI([
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'inputs:',
      '  username: alice',
      'body:',
      '  missinge: e:xxx',
      '  missingi: i:xxx',
      '  missingr: r:xxx',
      '  missingc: c:xxx',
      '  strmissinge: "e:xxx"',
    ].join('\n'));
    const resolved = resolveApiRequest(
        api, {}, {}, {refreshRuntimeTokens: true, preserveStructuredBody: true});
    const sent = String(requestForSend(resolved, 'json').body);
    const resent = yamlToAPI([
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'inputs:',
      '  username: alice',
      'body: |',
      ...sent.split('\n').map(line => `  ${line}`),
    ].join('\n'));
    const js = await apiToJSfunc({
      api: resent, name: 'echo', inputs: {}, envVars: {},
    });
    expect(js).toContain('JSON.stringify(mmtEnv_("xxx"))');
    expect(js).toContain('"missingi":"i:xxx"');
    expect(js).toContain("JSON.stringify(mmtRandom_('xxx'))");
    expect(js).toContain("JSON.stringify(mmtCurrent_('xxx'))");
    expect(js).toContain('"strmissinge":"e:xxx"');
    expect(js).not.toContain('<${mmtEnv_');
    expect(js).not.toContain('<<');
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

  it('sends quoted body tokens as text and bare tokens as values', async () => {
    const api = yamlToAPI([
      'type: api',
      'url: https://test.mmt.dev/echo',
      'method: post',
      'format: json',
      'inputs:',
      '  username: alice',
      '  age: 100',
      'body:',
      '  name: i:username',
      '  years: i:age',
      '  quotedName: "i:username"',
      '  quotedAge: "i:age"',
      '  quotedMissing: "i:xxx"',
    ].join('\n'));
    const js = await apiToJSfunc({
      api, name: 'echo', inputs: {}, envVars: {},
    });
    expect(js).toContain('"${username}"');
    expect(js).toContain('${JSON.stringify(age)}');
    expect(js).toContain('"quotedName":"i:username"');
    expect(js).toContain('"quotedAge":"i:age"');
    expect(js).toContain('"quotedMissing":"i:xxx"');
    expect(js).not.toContain('quotedName":"${username}"');
    expect(js).not.toContain('quotedAge":${JSON.stringify(age)}');
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
