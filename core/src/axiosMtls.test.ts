import axios from 'axios';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

import {send, setRunnerNetworkConfig} from './networkCore';

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

    const response = await send({
      protocol: 'http',
      url,
      method: 'get',
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain('client.<br>badssl.com');
  }, 30000);
});
