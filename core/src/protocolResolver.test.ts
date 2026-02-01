import {getEffectiveProtocol, resolveProtocolFromUrl} from './protocolResolver';

describe('protocolResolver', () => {
  describe('resolveProtocolFromUrl', () => {
    it('returns ws for ws:// URLs', () => {
      expect(resolveProtocolFromUrl('ws://localhost:8080/ws')).toBe('ws');
    });

    it('returns ws for wss:// URLs', () => {
      expect(resolveProtocolFromUrl('wss://secure.example.com/ws')).toBe('ws');
    });

    it('returns http for http:// URLs', () => {
      expect(resolveProtocolFromUrl('http://localhost:3000/api')).toBe('http');
    });

    it('returns http for https:// URLs', () => {
      expect(resolveProtocolFromUrl('https://api.example.com/v1')).toBe('http');
    });

    it('returns http for URLs without scheme', () => {
      expect(resolveProtocolFromUrl('api.example.com/users')).toBe('http');
    });

    it('returns http for null/undefined', () => {
      expect(resolveProtocolFromUrl(null)).toBe('http');
      expect(resolveProtocolFromUrl(undefined)).toBe('http');
    });

    it('returns http for empty string', () => {
      expect(resolveProtocolFromUrl('')).toBe('http');
    });

    it('handles case insensitive URLs', () => {
      expect(resolveProtocolFromUrl('WS://EXAMPLE.COM')).toBe('ws');
      expect(resolveProtocolFromUrl('WSS://Example.com')).toBe('ws');
      expect(resolveProtocolFromUrl('Wss://Mixed.Case/path')).toBe('ws');
    });

    it('handles URLs with leading/trailing whitespace', () => {
      expect(resolveProtocolFromUrl('  ws://example.com  ')).toBe('ws');
      expect(resolveProtocolFromUrl('\twss://example.com\n')).toBe('ws');
    });
  });

  describe('getEffectiveProtocol', () => {
    it('returns explicit protocol when provided', () => {
      expect(getEffectiveProtocol('ws', 'http://example.com')).toBe('ws');
      expect(getEffectiveProtocol('http', 'wss://example.com')).toBe('http');
    });

    it('infers from URL when protocol not provided', () => {
      expect(getEffectiveProtocol(undefined, 'wss://example.com')).toBe('ws');
      expect(getEffectiveProtocol(undefined, 'ws://example.com')).toBe('ws');
      expect(getEffectiveProtocol(undefined, 'https://example.com')).toBe('http');
      expect(getEffectiveProtocol(undefined, 'http://example.com')).toBe('http');
    });

    it('returns http when both protocol and URL are undefined', () => {
      expect(getEffectiveProtocol(undefined, undefined)).toBe('http');
    });
  });
});
