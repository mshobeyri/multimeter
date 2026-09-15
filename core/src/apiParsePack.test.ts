import {apiToYaml, applyAuthToRequest, validateAuth, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

describe('apiParsePack', () => {
  it('parses legacy import blocks on APIs', () => {
    const api = yamlToAPI([
      'type: api',
      'title: Example API',
      'import:',
      '  auth: ./auth.mmt',
      'url: https://example.com',
      'format: json',
    ].join('\n'));

    expect(api).toMatchObject({
      type: 'api',
      title: 'Example API',
      url: 'https://example.com',
      format: 'json',
      import: {auth: './auth.mmt'},
    });
  });

  it('does not invent import blocks when serializing APIs', () => {
    const yaml = apiToYaml({
      type: 'api',
      title: 'Example API',
      url: 'https://example.com',
      format: 'json',
      inputs: {id: '123'},
    } as any);

    expect(yaml).toContain('type: api');
    expect(yaml).toContain('inputs:');
    expect(yaml).not.toContain('import:');
  });

  it('yamlToAPI recovers incomplete url/method scalars while typing schemes', () => {
    const httpPartial = yamlToAPI([
      'type: api',
      'url: http:',
      'method: get',
    ].join('\n'));
    expect(httpPartial.url).toBe('http:');
    expect(typeof httpPartial.url).toBe('string');

    const httpsPartial = yamlToAPI('type: api\nurl: https:');
    expect(httpsPartial.url).toBe('https:');

    const wsPartial = yamlToAPI('type: api\nurl: ws:');
    expect(wsPartial.url).toBe('ws:');

    const methodPartial = yamlToAPI('type: api\nurl: https://x\nmethod: http:');
    expect(methodPartial.method).toBe('http:');
    expect(typeof methodPartial.method).toBe('string');
  });

  it('apiToYaml does not add title when missing', () => {
    const yaml = apiToYaml({
      type: 'api',
      url: 'https://example.com',
      format: 'json',
    } as any);

    expect(yaml).toContain('type: api');
    expect(yaml).not.toContain('title:');
  });

  it('serializes multiline description as a literal block', () => {
    const yaml = apiToYaml({
      type: 'api',
      title: 'Example API',
      description: 'line one\nline two',
      url: 'https://example.com',
      format: 'json',
    } as any);

    expect(yaml).toContain('description: |-');
    expect(yaml).toContain('  line one');
    expect(yaml).toContain('  line two');
  });

  it('converts folded multiline description to a literal block on format', () => {
    const input = `type: api
description: Send a JSON payload to an echo endpoint and verify that the server
  returns it back.
url: https://test.mmt.dev/echo
method: post
format: json
`;
    const yaml = apiToYaml(yamlToAPI(input));

    expect(yaml).toContain('description: |-');
    expect(yaml).toContain('  Send a JSON payload to an echo endpoint and verify that the server');
    expect(yaml).toContain('  returns it back.');
    expect(yaml).not.toMatch(/description: Send a JSON payload[\s\S]*returns it back\.\nurl:/);
  });
});

describe('yamlToAPIStrict', () => {
  it('throws on invalid YAML syntax', () => {
    expect(() => yamlToAPIStrict('bad: [unclosed')).toThrow();
  });

  it('throws when type is not api', () => {
    expect(() => yamlToAPIStrict('type: test\nurl: http://x.com')).toThrow(/expected type "api"/);
  });

  it('throws when url is missing', () => {
    expect(() => yamlToAPIStrict('type: api\ntitle: No URL')).toThrow(/missing required "url"/);
  });

  it('parses valid API successfully', () => {
    const api = yamlToAPIStrict('type: api\nurl: http://example.com\nformat: json');
    expect(api.url).toBe('http://example.com');
    expect(api.type).toBe('api');
  });

  it('parses and serializes request timeout', () => {
    const api = yamlToAPIStrict([
      'type: api',
      'url: http://example.com',
      'method: get',
      'timeout: 5000',
      'format: json',
    ].join('\n'));

    expect(api.timeout).toBe(5000);
    expect(apiToYaml(api)).toContain('timeout: 5000');
  });

  it('throws when timeout is not a non-negative number', () => {
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: http://example.com',
      'timeout: fast',
    ].join('\n'))).toThrow(/timeout.*non-negative number/i);
  });
});

describe('graphql/grpc round-trip', () => {
  it('preserves graphql section through yamlToAPI → apiToYaml', () => {
    const yaml = [
      'type: api',
      'title: GraphQL Example',
      'url: https://api.example.com/graphql',
      'protocol: graphql',
      'graphql:',
      '  operation: |',
      '    query GetUsers($limit: Int) {',
      '      users(limit: $limit) { id name }',
      '    }',
      '  variables:',
      '    limit: 10',
      '  operationName: GetUsers',
    ].join('\n');
    const api = yamlToAPI(yaml);
    expect(api.graphql).toBeDefined();
    expect(api.graphql!.operationName).toBe('GetUsers');
    const out = apiToYaml(api);
    expect(out).toContain('graphql:');
    expect(out).toContain('operation:');
    expect(out).toContain('operationName: GetUsers');
  });

  it('preserves grpc section through yamlToAPI → apiToYaml', () => {
    const yaml = [
      'type: api',
      'title: gRPC Example',
      'url: grpc://localhost:50051',
      'protocol: grpc',
      'grpc:',
      '  proto: ./greeter.proto',
      '  service: greeter.Greeter',
      '  method: SayHello',
      '  message:',
      '    name: Multimeter',
    ].join('\n');
    const api = yamlToAPI(yaml);
    expect(api.grpc).toBeDefined();
    expect(api.grpc!.service).toBe('greeter.Greeter');
    expect(api.grpc!.method).toBe('SayHello');
    const out = apiToYaml(api);
    expect(out).toContain('grpc:');
    expect(out).toContain('service: greeter.Greeter');
    expect(out).toContain('method: SayHello');
    expect(out).toContain('proto: ./greeter.proto');
  });

  it('preserves grpc stream field through round-trip', () => {
    const yaml = [
      'type: api',
      'title: gRPC Stream',
      'url: grpc://localhost:50051',
      'protocol: grpc',
      'grpc:',
      '  service: chat.Chat',
      '  method: StreamMessages',
      '  stream: bidi',
    ].join('\n');
    const api = yamlToAPI(yaml);
    expect(api.grpc!.stream).toBe('bidi');
    const out = apiToYaml(api);
    expect(out).toContain('stream: bidi');
  });
});

describe('yamlToAPIStrict and auth failures', () => {
  it('throws on empty yaml, unknown keys, and protocol mismatches', () => {
    expect(() => yamlToAPIStrict('')).toThrow(/empty or not an object/);
    expect(() => yamlToAPIStrict('type: api\nurl: https://x\nfoo: 1')).toThrow(/unknown key/);
    expect(() => yamlToAPIStrict('type: api\nurl: https://x\nprotocol: graphql')).toThrow(/graphql.operation/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: graphql',
      'graphql:',
      '  operation: query { a }',
      'body: nope',
    ].join('\n'))).toThrow(/body.*not valid for protocol "graphql"/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: http',
      'graphql:',
      '  operation: query { a }',
    ].join('\n'))).toThrow(/graphql.*ignored/);
    expect(() => yamlToAPIStrict('type: api\nurl: https://x\nprotocol: grpc')).toThrow(/grpc.service/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: grpc',
      'grpc:',
      '  service: s',
    ].join('\n'))).toThrow(/grpc.method/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: grpc',
      'grpc:',
      '  service: s',
      '  method: m',
      'body: x',
    ].join('\n'))).toThrow(/body.*not valid for protocol "grpc"/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: grpc',
      'grpc:',
      '  service: s',
      '  method: m',
      'query:',
      '  a: 1',
    ].join('\n'))).toThrow(/query.*not valid for protocol "grpc"/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: grpc',
      'grpc:',
      '  service: s',
      '  method: m',
      'cookies:',
      '  a: 1',
    ].join('\n'))).toThrow(/cookies.*not valid for protocol "grpc"/);
    expect(() => yamlToAPIStrict([
      'type: api',
      'url: https://x',
      'protocol: http',
      'grpc:',
      '  service: s',
      '  method: m',
    ].join('\n'))).toThrow(/grpc.*ignored/);
  });

  it('rejects invalid auth and applies valid auth to requests', () => {
    expect(validateAuth(undefined)).toBeUndefined();
    expect(validateAuth('none')).toBe('none');
    expect(() => validateAuth('bearer')).toThrow(/expected an object/);
    expect(() => validateAuth({type: 'digest'})).toThrow(/Invalid auth type/);
    expect(() => validateAuth({type: 'bearer'})).toThrow(/token/);
    expect(() => validateAuth({type: 'basic', username: 'a'})).toThrow(/username.*password/);
    expect(() => validateAuth({type: 'api-key', value: 'v'})).toThrow(/header" or "query"/);
    expect(() => validateAuth({type: 'api-key', value: 'v', header: 'H', query: 'q'})).toThrow(/exactly one/);
    expect(() => validateAuth({type: 'oauth2', grant: 'password', token_url: 't', client_id: 'i', client_secret: 's'}))
        .toThrow(/client_credentials/);
    expect(() => validateAuth({type: 'oauth2', grant: 'client_credentials'})).toThrow(/token_url/);
    expect(() => validateAuth({type: 'oauth2', token_url: 't'})).toThrow(/client_id/);
    expect(() => validateAuth({type: 'oauth2', token_url: 't', client_id: 'i'})).toThrow(/client_secret/);
    expect(validateAuth({type: 'api-key', value: 'v', query: 'api_key'})).toEqual({
      type: 'api-key', query: 'api_key', value: 'v',
    });
    expect(applyAuthToRequest(undefined, {A: '1'})).toEqual({headers: {A: '1'}, query: undefined});
    expect(applyAuthToRequest('none', {A: '1'})).toEqual({headers: {A: '1'}, query: undefined});
    expect(applyAuthToRequest({type: 'bearer', token: 't'}, {}).headers.Authorization).toBe('Bearer t');
    expect(applyAuthToRequest({type: 'bearer', token: 't'}, {Authorization: 'keep'}).headers.Authorization).toBe('keep');
    expect(applyAuthToRequest({type: 'basic', username: 'u', password: 'p'}, {}).headers.Authorization)
        .toMatch(/^Basic /);
    expect(applyAuthToRequest({type: 'api-key', header: 'X-Key', value: 'k'}, {}).headers['X-Key']).toBe('k');
    expect(applyAuthToRequest({type: 'api-key', query: 'k', value: 'v'}, {}, {}).query).toEqual({k: 'v'});
    expect(applyAuthToRequest({type: 'oauth2', grant: 'client_credentials', token_url: 't', client_id: 'i', client_secret: 's'}, {A: '1'}).headers)
        .toEqual({A: '1'});
  });

  it('yamlToAPI stays lenient on junk, invalid auth, and format maps', () => {
    expect(yamlToAPI('null').url).toBeFalsy();
    expect(() => yamlToAPI('not: yaml: :')).not.toThrow();
    expect(yamlToAPI('type: api\nurl: https://x\nauth: bearer').auth).toBeUndefined();
    expect(yamlToAPI('type: api\nurl: https://x\nformat: yaml').format).toBe('json');
    expect(yamlToAPI('type: api\nurl: https://x\nformat:\n  request: xml\n  response: text').format)
        .toEqual({request: 'xml', response: 'text'});
    expect(yamlToAPI('type: api\nurl: https://x\nformat:\n  request: nope').format).toBe('json');
    const packed = apiToYaml({
      type: 'api',
      url: 'https://x',
      tags: ['a'],
      import: {auth: './a.mmt'},
      outputs: {id: 'body.id'},
      setenv: {t: 'body.t'},
      query: {q: '1'},
      cookies: {c: '2'},
      headers: {H: '3'},
      auth: {type: 'bearer', token: 'tok'},
      grpc: {service: 's', method: 'm', proto: 'a.proto', message: {ok: true}, stream: 'server'},
      examples: [{name: 'one', outputs: {id: 1}}],
    } as any);
    expect(packed).toContain('setenv:');
    expect(packed).toContain('cookies:');
    expect(packed).toContain('proto:');
    expect(packed).toContain('examples:');
  });
});