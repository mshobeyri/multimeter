import {
  applyClientCertMaterialMode,
  applyClientCertPassphraseMode,
  clientCertFieldIssues,
  clientCertMaterialMode,
  clientCertPassphraseMode,
  isPresentCertPath,
} from './clientCertificateFields';

describe('clientCertificateFields', () => {
  it('treats pfx as PKCS#12 mode even when a PEM pair is also set', () => {
    expect(clientCertMaterialMode({pfx: './certs/client.p12'})).toBe('pfx');
    expect(clientCertMaterialMode({
      pfx: './certs/client.p12',
      cert: './certs/client.crt',
    })).toBe('pfx');
    expect(clientCertMaterialMode({
      cert: './certs/client.crt',
      key: './certs/client.key',
    })).toBe('pem');
    expect(clientCertMaterialMode({name: 'empty'} as any)).toBe('pem');
  });

  it('prefers passphrase_plain when both passphrase fields are set', () => {
    expect(clientCertPassphraseMode({passphrase_plain: 'secret'})).toBe('plain');
    expect(clientCertPassphraseMode({passphrase_env: 'CERT_PASS'})).toBe('env');
    expect(clientCertPassphraseMode({
      passphrase_plain: 'secret',
      passphrase_env: 'CERT_PASS',
    })).toBe('plain');
    expect(clientCertPassphraseMode({})).toBe('env');
  });

  it('clears the other material when switching modes', () => {
    expect(applyClientCertMaterialMode({
      cert: './certs/client.crt',
      key: './certs/client.key',
      passphrase_plain: 'mmt',
    }, 'pfx')).toEqual({passphrase_plain: 'mmt'});
    expect(applyClientCertMaterialMode({
      pfx: './certs/client.p12',
      passphrase_env: 'CERT_PASS',
    }, 'pem')).toEqual({passphrase_env: 'CERT_PASS'});
  });

  it('clears the other passphrase field when switching modes', () => {
    expect(applyClientCertPassphraseMode({
      passphrase_plain: 'secret',
      passphrase_env: 'CERT_PASS',
    }, 'plain')).toEqual({passphrase_plain: 'secret'});
    expect(applyClientCertPassphraseMode({
      passphrase_plain: 'secret',
      passphrase_env: 'CERT_PASS',
    }, 'env')).toEqual({passphrase_env: 'CERT_PASS'});
  });

  it('reports mixed pfx and cert/key, and incomplete PEM pairs', () => {
    expect(clientCertFieldIssues({
      pfx: './certs/client.p12',
      cert: './certs/client.crt',
    })).toEqual([{
      field: 'pfx',
      message: 'Use either pfx or cert+key, not both',
    }]);
    expect(clientCertFieldIssues({cert: './certs/client.crt'})).toEqual([{
      field: 'cert',
      message: 'key is required when cert is set',
    }]);
    expect(clientCertFieldIssues({key: './certs/client.key'})).toEqual([{
      field: 'key',
      message: 'cert is required when key is set',
    }]);
    expect(clientCertFieldIssues({
      cert: './certs/client.crt',
      key: './certs/client.key',
    })).toEqual([]);
    expect(clientCertFieldIssues({pfx: './certs/client.p12'})).toEqual([]);
    expect(clientCertFieldIssues({})).toEqual([]);
    expect(isPresentCertPath('  ')).toBe(false);
  });

  it('reports mixed passphrase_plain and passphrase_env', () => {
    expect(clientCertFieldIssues({
      pfx: './certs/client.p12',
      passphrase_plain: 'secret',
      passphrase_env: 'CERT_PASS',
    })).toEqual([{
      field: 'passphrase_plain',
      message: 'Use either passphrase_plain or passphrase_env, not both',
    }]);
    expect(clientCertFieldIssues({
      passphrase_env: 'CERT_PASS',
    })).toEqual([]);
  });
});
