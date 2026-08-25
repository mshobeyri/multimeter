import * as fs from 'fs';
import * as path from 'path';
import * as tls from 'tls';

import {yamlToEnv} from './envParsePack';

describe('PKCS#12 certificate examples', () => {
  const mockCertDir = path.resolve(
      __dirname, '../../examples/professional/06_mtls_mock_server/certs');
  const badsslCertDir = path.resolve(
      __dirname, '../../examples/professional/08_external_mtls_badssl/certs');

  function readExample(dir: string, name: string): Buffer {
    return fs.readFileSync(path.join(dir, name));
  }

  function readExampleText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  it('loads the mock-server client.p12 next to the PEM cert and key', () => {
    expect(fs.existsSync(path.join(mockCertDir, 'client.crt'))).toBe(true);
    expect(fs.existsSync(path.join(mockCertDir, 'client.key'))).toBe(true);
    expect(fs.existsSync(path.join(mockCertDir, 'client.p12'))).toBe(true);
    expect(() => {
      tls.createSecureContext({
        pfx: readExample(mockCertDir, 'client.p12'),
        passphrase: 'mmt',
      });
    }).not.toThrow();
  });

  it('loads the BadSSL client.p12 next to the PEM cert and key', () => {
    expect(fs.existsSync(path.join(badsslCertDir, 'badssl-client.crt'))).toBe(true);
    expect(fs.existsSync(path.join(badsslCertDir, 'badssl-client.key'))).toBe(true);
    expect(fs.existsSync(path.join(badsslCertDir, 'badssl-client.p12'))).toBe(true);
    expect(() => {
      tls.createSecureContext({
        pfx: readExample(badsslCertDir, 'badssl-client.p12'),
        passphrase: 'badssl.com',
      });
    }).not.toThrow();
  });

  it('parses PKCS#12 clients in the mTLS example env files', () => {
    const mockEnv = yamlToEnv(readExampleText(path.resolve(
        mockCertDir, '..', 'multimeter.mmt')));
    const mockP12 = mockEnv.certificates?.clients?.find(client => client.pfx);
    expect(mockP12?.name).toBe('mock-client-p12');
    expect(mockP12?.pfx).toBe('./certs/client.p12');
    expect(mockP12?.passphrase_plain).toBe('mmt');
    expect(fs.existsSync(path.resolve(mockCertDir, '..', mockP12?.pfx || ''))).toBe(true);

    const badsslEnv = yamlToEnv(readExampleText(path.resolve(
        badsslCertDir, '..', 'multimeter.mmt')));
    const badsslP12 = badsslEnv.certificates?.clients?.find(client => client.pfx);
    expect(badsslP12?.name).toBe('BadSSL PKCS#12 client certificate');
    expect(badsslP12?.pfx).toBe('./certs/badssl-client.p12');
    expect(badsslP12?.passphrase_plain).toBe('badssl.com');
    expect(fs.existsSync(path.resolve(badsslCertDir, '..', badsslP12?.pfx || ''))).toBe(true);
  });
});
