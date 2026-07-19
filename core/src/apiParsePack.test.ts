import {apiToYaml, yamlToAPI, yamlToAPIStrict} from './apiParsePack';

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