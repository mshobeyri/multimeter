import {describe, expect, it} from '@jest/globals';
import {validateYamlContent} from './Validate';

describe('validateYamlContent API method requirements', () => {
  it('accepts data imports on API files', () => {
    const errors = validateYamlContent([
      'type: api',
      'import:',
      '  fixture: ./data/fixture.json',
      'url: https://example.com/${fixture.path}',
      'method: post',
      'body: ${fixture.payload}',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
  });

  it('allows whole data import references where the schema expects an object', () => {
    const errors = validateYamlContent([
      'type: env',
      'import:',
      '  certs: ./data/certs.yaml',
      'certificates:',
      '  clients: ${certs.clients}',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('/certificates/clients'))).toBe(false);
    expect(errors.some(error => String(error.message).includes('must be array'))).toBe(false);
  });

  it('allows whole data import references where the schema expects enum values', () => {
    const errors = validateYamlContent([
      'type: env',
      'import:',
      '  cfg: ./data/config.json',
      'setting:',
      '  http:',
      '    version: ${cfg.httpVersion}',
      '    timeout: ${cfg.timeout}',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('Invalid value'))).toBe(false);
    expect(errors.some(error => String(error.message).includes('must be number'))).toBe(false);
  });

  it('does not treat normal strings as data import schema exceptions', () => {
    const errors = validateYamlContent([
      'type: api',
      'url: https://example.com',
      'method: nope',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('Invalid value'))).toBe(true);
  });

  it('accepts data imports on env files', () => {
    const errors = validateYamlContent([
      'type: env',
      'import:',
      '  local: ./env.yaml',
      'variables:',
      '  url: ${local.url}',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
  });

  it('accepts data imports on suite and loadtest files', () => {
    const suiteErrors = validateYamlContent([
      'type: suite',
      'import:',
      '  flags: ./flags.yml',
      'items:',
      '  - ./tests/login.mmt',
    ].join('\n'));
    const loadErrors = validateYamlContent([
      'type: loadtest',
      'import:',
      '  load: ./load.json',
      'repeat: ${load.repeat}',
      'test: ./tests/login.mmt',
    ].join('\n'));

    expect(suiteErrors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
    expect(loadErrors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
  });

  it('accepts data imports on doc and server files', () => {
    const docErrors = validateYamlContent([
      'type: doc',
      'import:',
      '  meta: ./docs.yaml',
      'title: ${meta.title}',
    ].join('\n'));
    const serverErrors = validateYamlContent([
      'type: server',
      'import:',
      '  response: ./response.json',
      'port: 3000',
      'endpoints:',
      '  - path: /users',
      '    method: get',
      '    body: ${response.users}',
    ].join('\n'));

    expect(docErrors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
    expect(serverErrors.some(error => String(error.message).includes('Invalid property "import"'))).toBe(false);
  });

  it('does not require method for WebSocket URLs without explicit protocol', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Echo API WS',
      'url: wss://test.mmt.dev/ws',
      'format: json',
      'body: |-',
      '  {',
      '    "Message": "Hello"',
      '  }',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('method'))).toBe(false);
  });

  it('does not require method for explicit WebSocket protocol', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Echo API WS',
      'protocol: ws',
      'url: ws://test.mmt.dev/ws',
      'format: json',
      'body: Hello',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('method'))).toBe(false);
  });

  it('does not require top-level method for gRPC URLs without explicit protocol', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Greeter',
      'url: grpc://localhost:50051',
      'grpc:',
      '  service: helloworld.Greeter',
      '  method: SayHello',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(': must have required property \'method\''))).toBe(false);
  });

  it('does not require top-level method for explicit gRPC protocol', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Greeter',
      'protocol: grpc',
      'url: grpcs://localhost:50051',
      'grpc:',
      '  service: helloworld.Greeter',
      '  method: SayHello',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(': must have required property \'method\''))).toBe(false);
  });

  it('requires method for URLs inferred as HTTP', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: HTTP API',
      'url: https://test.mmt.dev/echo',
      'format: json',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('method'))).toBe(true);
  });

  it('requires top-level method for explicit HTTP even when the URL is WebSocket', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Forced HTTP',
      'protocol: http',
      'url: wss://test.mmt.dev/ws',
      'format: json',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('method'))).toBe(true);
  });

  it('explains that GraphQL uses graphql.operation instead of body', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Echo API',
      'url: https://test.mmt.dev',
      'protocol: graphql',
      'format: json',
      'body: |-',
      '  {',
      '    "Message": "Hello"',
      '  }',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes('graphql.operation'))).toBe(true);
    expect(errors.some(error => String(error.message).includes("required property 'graphql'"))).toBe(false);
    expect(errors.some(error => String(error.message).includes('then'))).toBe(false);
    expect(errors.some(error => String(error.message).startsWith(':'))).toBe(false);
  });

  it('does not show Ajv then-schema errors for invalid GraphQL over POST', () => {
    const errors = validateYamlContent([
      'type: api',
      'title: Echo API',
      'url: https://test.mmt.dev',
      'method: post',
      'protocol: graphql',
      'format: json',
      'body: |-',
      '  {',
      '    "Message": "Hello"',
      '  }',
    ].join('\n'));

    const messages = errors.map(error => String(error.message));
    expect(messages.some(message => message.includes('graphql.operation'))).toBe(true);
    expect(messages.some(message => message.includes('then'))).toBe(false);
    expect(messages.some(message => message.startsWith(':'))).toBe(false);
  });

  it('accepts null as a direct call expect value', () => {
    const errors = validateYamlContent([
      'type: test',
      'title: Test echo API',
      'import:',
      '  echo: echo_api.mmt',
      'steps:',
      '  - call: echo',
      '    expect:',
      '      echoed_message: hello',
      '      xxx: null',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(".steps[0].expect['xxx']"))).toBe(false);
  });

  it('accepts null as a direct http expect value', () => {
    const errors = validateYamlContent([
      'type: test',
      'title: HTTP inline test',
      'steps:',
      '  - http: https://example.com',
      '    method: get',
      '    expect:',
      '      body.token: null',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(".steps[0].expect['body.token']"))).toBe(false);
  });

  it('accepts arrays as direct call expect values', () => {
    const errors = validateYamlContent([
      'type: test',
      'title: Test echo API',
      'import:',
      '  echo: echo_api.mmt',
      'steps:',
      '  - call: echo',
      '    expect:',
      '      echoed_message:',
      '        - a',
      '        - b',
      '      xxx: !# 3',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(".steps[0].expect['echoed_message']"))).toBe(false);
  });

  it('marks additionalProperties at the schema path, not the first duplicate key name', () => {
    const content = [
      'type: env',
      'variables:',
      '  xxx: 1',
      'certificates:',
      '  clients:',
      '    - name: mock-client',
      '      host: localhost:29444',
      '      key: ./certs/client.key',
      '      cert: ./certs/client.crt',
      '      xxx: null',
    ].join('\n');
    const errors = validateYamlContent(content);
    const additionalPropertyError = errors.find(error =>
      String(error.message).includes('Invalid property "xxx"')
    );
    expect(additionalPropertyError).toBeDefined();
    expect(additionalPropertyError?.startLineNumber).toBe(10);
    expect(additionalPropertyError?.startLineNumber).not.toBe(3);
  });

  it('accepts arrays as direct http expect values', () => {
    const errors = validateYamlContent([
      'type: test',
      'title: HTTP inline test',
      'steps:',
      '  - http: https://example.com',
      '    method: get',
      '    expect:',
      '      body.items:',
      '        - a',
      '        - b',
    ].join('\n'));

    expect(errors.some(error => String(error.message).includes(".steps[0].expect['body.items']"))).toBe(false);
  });
});