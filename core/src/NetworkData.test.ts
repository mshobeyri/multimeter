import {
  resolvePassphrase,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_CERT_SETTINGS,
  matchesCertificateHost,
} from './NetworkData';

describe('resolvePassphrase', () => {
  it('returns plain passphrase when provided', () => {
    expect(resolvePassphrase('secret')).toBe('secret');
  });

  it('prefers plain passphrase over env var', () => {
    expect(resolvePassphrase('plain', 'MY_PASS', {MY_PASS: 'from-env'}))
        .toBe('plain');
  });

  it('resolves from envVars when passphraseEnv matches', () => {
    expect(resolvePassphrase(undefined, 'DB_PASS', {DB_PASS: 'env-val'}))
        .toBe('env-val');
  });

  it('coerces non-string envVar values to string', () => {
    expect(resolvePassphrase(undefined, 'NUM', {NUM: 42})).toBe('42');
  });

  it('falls back to processEnv when envVars has no match', () => {
    expect(resolvePassphrase(undefined, 'SYS_PASS', {}, {SYS_PASS: 'sys-val'}))
        .toBe('sys-val');
  });

  it('prefers envVars over processEnv', () => {
    expect(resolvePassphrase(
        undefined, 'KEY', {KEY: 'app'}, {KEY: 'sys'})).toBe('app');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolvePassphrase(undefined, 'MISSING', {}, {})).toBeUndefined();
  });

  it('returns undefined when no args provided', () => {
    expect(resolvePassphrase()).toBeUndefined();
  });
});

describe('DEFAULT_NETWORK_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_NETWORK_CONFIG.sslValidation).toBe(true);
    expect(DEFAULT_NETWORK_CONFIG.allowSelfSigned).toBe(false);
    expect(DEFAULT_NETWORK_CONFIG.timeout).toBe(30000);
    expect(DEFAULT_NETWORK_CONFIG.autoFormat).toBe(false);
    expect(DEFAULT_NETWORK_CONFIG.ca.enabled).toBe(false);
    expect(DEFAULT_NETWORK_CONFIG.clients).toEqual([]);
  });
});

describe('DEFAULT_CERT_SETTINGS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CERT_SETTINGS.sslValidation).toBe(true);
    expect(DEFAULT_CERT_SETTINGS.allowSelfSigned).toBe(false);
    expect(DEFAULT_CERT_SETTINGS.caEnabled).toBe(false);
    expect(DEFAULT_CERT_SETTINGS.clientsEnabled).toEqual({});
  });
});

describe('matchesCertificateHost', () => {
  it('matches bare domains against exact hosts and subdomains', () => {
    expect(matchesCertificateHost('example.com', 'example.com', '443', 'https:')).toBe(true);
    expect(matchesCertificateHost('example.com', 'api.example.com', '443', 'https:')).toBe(true);
    expect(matchesCertificateHost('example.com', 'other.com', '443', 'https:')).toBe(false);
  });

  it('matches wildcard subdomains without matching the root domain', () => {
    expect(matchesCertificateHost('*.api.example.com', 'v1.api.example.com', '443', 'https:')).toBe(true);
    expect(matchesCertificateHost('*.api.example.com', 'api.example.com', '443', 'https:')).toBe(false);
  });

  it('matches host-port patterns including any-host on a fixed port', () => {
    expect(matchesCertificateHost('*:8085', 'service.local', '8085', 'https:')).toBe(true);
    expect(matchesCertificateHost('*:8085', 'service.local', '8086', 'https:')).toBe(false);
    expect(matchesCertificateHost('secure.example.com:8085', 'secure.example.com', '8085', 'https:')).toBe(true);
    expect(matchesCertificateHost('secure.example.com:8085', 'api.secure.example.com', '8085', 'https:')).toBe(true);
  });

  it('uses protocol default ports when the URL omits one', () => {
    expect(matchesCertificateHost('*:443', 'secure.example.com', '', 'https:')).toBe(true);
    expect(matchesCertificateHost('*:80', 'secure.example.com', '', 'https:')).toBe(false);
  });
});
