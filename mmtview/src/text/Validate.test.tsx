import {describe, expect, it} from '@jest/globals';
import {validateYamlContent} from './Validate';

describe('validateYamlContent API method requirements', () => {
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
});