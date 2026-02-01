import {protocolResolver} from 'mmt-core';

describe('useNetwork protocol inference', () => {
  it('infers ws when protocol is missing and url is wss://', () => {
    expect(protocolResolver.getEffectiveProtocol(undefined, 'wss://example.com/ws')).toBe('ws');
  });

  it('infers http when protocol is missing and url is https://', () => {
    expect(protocolResolver.getEffectiveProtocol(undefined, 'https://example.com/api')).toBe('http');
  });

  it('uses explicit protocol when provided', () => {
    expect(protocolResolver.getEffectiveProtocol('ws', 'https://example.com/api')).toBe('ws');
  });
});
