import {
  buildMockHttpsOptions,
  getDefaultMockTlsMaterial,
  resetDefaultMockTlsMaterialForTests,
} from './mockTlsMaterial';

describe('mockTlsMaterial', () => {
  afterEach(() => {
    resetDefaultMockTlsMaterialForTests();
  });

  test('getDefaultMockTlsMaterial returns PEM cert/key and memoizes', () => {
    const a = getDefaultMockTlsMaterial();
    const b = getDefaultMockTlsMaterial();
    expect(a).toBe(b);
    expect(a.cert).toMatch(/BEGIN CERTIFICATE/);
    expect(a.key).toMatch(/BEGIN (RSA )?PRIVATE KEY/);
  }, 30000);

  test('buildMockHttpsOptions requires cert+key together', () => {
    expect(() => buildMockHttpsOptions(
        {cert: 'a.pem'},
        () => '',
        (p) => p,
        {cert: 'c', key: 'k'},
        )).toThrow(/together/);
  });

  test('buildMockHttpsOptions uses defaults when no custom cert', () => {
    const opts = buildMockHttpsOptions(
        {},
        () => {
          throw new Error('should not read');
        },
        (p) => p,
        {cert: 'DEF_CERT', key: 'DEF_KEY'},
    );
    expect(opts.cert).toBe('DEF_CERT');
    expect(opts.key).toBe('DEF_KEY');
  });

  test('buildMockHttpsOptions reads custom cert paths', () => {
    const reads: string[] = [];
    const opts = buildMockHttpsOptions(
        {cert: 'cert.pem', key: 'key.pem', client_ca: 'ca.pem', mode: 'mtls'},
        (p) => {
          reads.push(p);
          return `data:${p}`;
        },
        (p) => `/abs/${p}`,
    );
    expect(reads).toEqual(['/abs/cert.pem', '/abs/key.pem', '/abs/ca.pem']);
    expect(opts.cert).toBe('data:/abs/cert.pem');
    expect(opts.key).toBe('data:/abs/key.pem');
    expect(opts.ca).toBe('data:/abs/ca.pem');
    expect(opts.requestCert).toBe(true);
    expect(opts.rejectUnauthorized).toBe(true);
  });

  test('mtls without client_ca throws', () => {
    expect(() => buildMockHttpsOptions(
        {mode: 'mtls'},
        () => '',
        (p) => p,
        {cert: 'c', key: 'k'},
        )).toThrow(/client_ca/);
  });
});
