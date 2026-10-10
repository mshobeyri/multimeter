import * as http from 'http';

import {DEFAULT_NETWORK_CONFIG} from './NetworkData';
import {closeAllHttpConnections, sendHttpRequest} from './networkCore';

describe('keep-alive after an error response', () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        hits += 1;
        if (hits === 1) {
          res.writeHead(400, {'Content-Type': 'application/json'});
          res.end('{"error":"bad"}');
          res.socket?.end();
          return;
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end('{"ok":true}');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : 0;
      done();
    });
  });

  afterEach(() => {
    closeAllHttpConnections();
  });

  afterAll(async () => {
    closeAllHttpConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('opens a fresh connection for the call after a 400 that closes the socket', async () => {
    const url = `http://127.0.0.1:${port}/echo`;
    const first = await sendHttpRequest(
        {url, method: 'post', body: '{"xxx":"asdasd"}', timeout: 1000},
        DEFAULT_NETWORK_CONFIG,
    );
    const second = await sendHttpRequest(
        {url, method: 'post', body: '{"xxx":12}', timeout: 1000},
        DEFAULT_NETWORK_CONFIG,
    );

    expect(first.status).toBe(400);
    expect(second.status).toBe(200);
    expect(String(second.statusText)).not.toMatch(/ECONNRESET|timeout|hang up/i);
  });
});
