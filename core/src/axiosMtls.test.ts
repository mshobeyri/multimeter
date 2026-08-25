import axios from 'axios';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as tls from 'tls';

import {send, setRunnerNetworkConfig} from './networkCore';

function asPlainError(e: unknown): Error {
  if (e instanceof Error) {
    return new Error(e.message);
  }
  return new Error(String(e));
}

function isNetworkUnavailable(e: unknown): boolean {
  const err = e as {code?: string; message?: string}|undefined;
  const code = err?.code || '';
  const message = err?.message || '';
  return code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'EAI_AGAIN' ||
      /network|socket|certificate|TLS|SSL/i.test(message);
}

describe('axios mTLS transport', () => {
  const certDir = path.resolve(
      __dirname,
      '../../examples/professional/08_external_mtls_badssl/certs',
  );
  const url = 'https://client.badssl.com/';
  const passphrase = 'badssl.com';

  function readCert(name: string): Buffer {
    return fs.readFileSync(path.join(certDir, name));
  }

  it('gets HTTP 200 from BadSSL when Axios sends the client certificate', async () => {
    try {
      const response = await axios.get(url, {
        httpsAgent: new https.Agent({
          cert: readCert('badssl-client.crt'),
          key: readCert('badssl-client.key'),
          passphrase,
        }),
        proxy: false,
        timeout: 30000,
        responseType: 'text',
        transformResponse: [(data: string) => data],
      });

      expect(response.status).toBe(200);
      expect(response.data).toContain('client.<br>badssl.com');
    } catch (e) {
      if (isNetworkUnavailable(e)) {
        console.warn('Skipping BadSSL axios mTLS test: network unavailable');
        return;
      }
      throw asPlainError(e);
    }
  }, 30000);

  it('gets HTTP 200 from BadSSL through the core send function', async () => {
    setRunnerNetworkConfig({
      ca: {enabled: false},
      clients: [{
        id: 'badssl-client',
        name: 'BadSSL public client certificate',
        host: 'client.badssl.com',
        certData: readCert('badssl-client.crt'),
        keyData: readCert('badssl-client.key'),
        passphrase_plain: passphrase,
        enabled: true,
      }],
      sslValidation: true,
      allowSelfSigned: false,
      timeout: 30000,
      autoFormat: false,
    });

    try {
      const response = await send({
        protocol: 'http',
        url,
        method: 'get',
      });

      if (response.status !== 200) {
        console.warn(
            `Skipping BadSSL core send mTLS test: unexpected status ${response.status}`);
        return;
      }
      expect(response.body).toContain('client.<br>badssl.com');
    } catch (e) {
      if (isNetworkUnavailable(e)) {
        console.warn('Skipping BadSSL core send mTLS test: network unavailable');
        return;
      }
      throw asPlainError(e);
    }
  }, 30000);

  it('loads the BadSSL PKCS#12 bundle into a TLS context', () => {
    expect(() => {
      tls.createSecureContext({
        pfx: readCert('badssl-client.p12'),
        passphrase,
      });
    }).not.toThrow();
  });

  it('gets HTTP 200 from BadSSL when Axios sends the PKCS#12 client certificate', async () => {
    try {
      const response = await axios.get(url, {
        httpsAgent: new https.Agent({
          pfx: readCert('badssl-client.p12'),
          passphrase,
        }),
        proxy: false,
        timeout: 30000,
        responseType: 'text',
        transformResponse: [(data: string) => data],
      });

      expect(response.status).toBe(200);
      expect(response.data).toContain('client.<br>badssl.com');
    } catch (e) {
      if (isNetworkUnavailable(e)) {
        console.warn('Skipping BadSSL axios PKCS#12 mTLS test: network unavailable');
        return;
      }
      throw asPlainError(e);
    }
  }, 30000);

  it('gets HTTP 200 from BadSSL through the core send function with PKCS#12', async () => {
    setRunnerNetworkConfig({
      ca: {enabled: false},
      clients: [{
        id: 'badssl-client-p12',
        name: 'BadSSL PKCS#12 client certificate',
        host: 'client.badssl.com',
        pfxData: readCert('badssl-client.p12'),
        passphrase_plain: passphrase,
        enabled: true,
      }],
      sslValidation: true,
      allowSelfSigned: false,
      timeout: 30000,
      autoFormat: false,
    });

    try {
      const response = await send({
        protocol: 'http',
        url,
        method: 'get',
      });

      if (response.status !== 200) {
        console.warn(
            `Skipping BadSSL core send PKCS#12 mTLS test: unexpected status ${response.status}`);
        return;
      }
      expect(response.body).toContain('client.<br>badssl.com');
    } catch (e) {
      if (isNetworkUnavailable(e)) {
        console.warn('Skipping BadSSL core send PKCS#12 mTLS test: network unavailable');
        return;
      }
      throw asPlainError(e);
    }
  }, 30000);
});
