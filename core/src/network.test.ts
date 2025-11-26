// Import from compiled JS to avoid TS compile on ws import in source
const path = require('path');
const fs = require('fs');
const distCandidates = [
  path.join(__dirname, '../dist/network.js'), // when running from core/src
  path.join(__dirname, '../../../core/dist/network.js'), // when running from out/core/src
];
const distPath = distCandidates.find(p => fs.existsSync(p));
if (!distPath) {
  throw new Error(`network.dist not found. Tried: ${distCandidates.join(', ')}`);
}
const { getCertificateStatusForUrl } = require(distPath);
import { NetworkConfig } from './NetworkData';

describe('network helpers', () => {
  const baseCfg: NetworkConfig = {
    sslValidation: true,
    autoFormat: true,
    ca: { enabled: true, certData: Buffer.from('abc') },
    clients: [
      { id: '1', name: 'c1', host: 'example.com', enabled: true },
      { id: '2', name: 'any', host: '*', enabled: false },
    ] as any,
    timeout: 1000,
  } as any;

  it('getCertificateStatusForUrl returns matching info for https', () => {
    const s = getCertificateStatusForUrl('https://api.example.com/users', baseCfg);
    expect(s).toEqual({
      protocol: 'https:',
      hostname: 'api.example.com',
      sslValidation: true,
      hasCA: true,
      hasClientCert: true,
      isSecure: true,
    });
  });

  it('getCertificateStatusForUrl works for ws and no match', () => {
    const s = getCertificateStatusForUrl('ws://host.other/path', baseCfg);
    expect(s).toMatchObject({ protocol: 'ws:', hostname: 'host.other', hasClientCert: false, isSecure: false });
  });

  it('returns null for invalid URL', () => {
    expect(getCertificateStatusForUrl('not a url', baseCfg)).toBeNull();
  });
});
