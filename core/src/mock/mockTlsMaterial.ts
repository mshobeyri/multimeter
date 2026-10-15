/**
 * Self-signed localhost TLS material for mock HTTPS servers (Node hosts).
 * Uses node-forge at runtime so no static private key ships in the package.
 */

export type MockTlsMaterial = {
  cert: string;
  key: string;
};

export type MockTlsConnection = {
  cert?: string;
  key?: string;
  client_ca?: string;
  mode?: string;
};

export type MockHttpsOptions = {
  cert: string|Buffer;
  key: string|Buffer;
  ca?: string|Buffer;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
};

let cachedDefaultTls: MockTlsMaterial|undefined;

/** Generate (and memoize) a localhost-only self-signed cert. */
export function getDefaultMockTlsMaterial(): MockTlsMaterial {
  if (cachedDefaultTls) {
    return cachedDefaultTls;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const forge = require('node-forge');
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 10);

  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = Math.max(Date.now(), 1).toString(16);
  certificate.validity.notBefore = now;
  certificate.validity.notAfter = expiresAt;

  const subject = [{name: 'commonName', value: 'localhost'}];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.setExtensions([
    {name: 'basicConstraints', cA: false},
    {name: 'keyUsage', digitalSignature: true, keyEncipherment: true},
    {name: 'extKeyUsage', serverAuth: true},
    {
      name: 'subjectAltName',
      altNames: [
        {type: 2, value: 'localhost'},
        {type: 7, ip: '127.0.0.1'},
        {type: 7, ip: '::1'},
      ],
    },
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  cachedDefaultTls = {
    cert: forge.pki.certificateToPem(certificate),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
  return cachedDefaultTls;
}

/** Reset memoized cert (tests only). */
export function resetDefaultMockTlsMaterialForTests(): void {
  cachedDefaultTls = undefined;
}

/**
 * Build https.ServerOptions from mock `connection:` (pure of fs — caller reads files).
 */
export function buildMockHttpsOptions(
    connection: MockTlsConnection|undefined,
    readFile: (resolvedPath: string) => string|Buffer,
    resolvePath: (relative: string) => string,
    defaultMaterial?: MockTlsMaterial,
    ): MockHttpsOptions {
  const conn = connection || {};
  const hasCustomCert = !!conn.cert || !!conn.key;
  if (hasCustomCert && (!conn.cert || !conn.key)) {
    throw new Error('connection.cert and connection.key must be provided together');
  }
  const fallback = hasCustomCert ? undefined : (defaultMaterial ?? getDefaultMockTlsMaterial());
  const options: MockHttpsOptions = {
    cert: conn.cert ? readFile(resolvePath(conn.cert)) : fallback!.cert,
    key: conn.key ? readFile(resolvePath(conn.key)) : fallback!.key,
  };
  if (conn.client_ca) {
    options.ca = readFile(resolvePath(conn.client_ca));
  }
  if (conn.mode === 'mtls') {
    if (!conn.client_ca) {
      throw new Error('connection.client_ca is required when connection.mode is mtls');
    }
    options.requestCert = true;
    options.rejectUnauthorized = true;
  }
  return options;
}
