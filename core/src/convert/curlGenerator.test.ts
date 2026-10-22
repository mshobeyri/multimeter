import {
  buildCurlCommand,
  buildCurlCommandSet,
  formatCurlCommandSet,
  quoteCurlArgument,
} from './curlGenerator';

describe('curlGenerator', () => {
  const sample = {
    method: 'post',
    url: 'https://example.com/users',
    query: {active: 'true'},
    headers: {'Content-Type': 'application/json', 'X-Trace': 'abc'},
    cookies: {sid: '123'},
    body: {name: 'Jane', note: "it's fine"},
  };

  it('quotes arguments per shell', () => {
    expect(quoteCurlArgument('posix', `a'b`)).toBe(`'a'\\''b'`);
    expect(quoteCurlArgument('powershell', `a'b`)).toBe(`'a''b'`);
    expect(quoteCurlArgument('cmd', `a"b`)).toBe(`"a""b"`);
  });

  it('builds posix curl with single quotes and data-raw', () => {
    const cmd = buildCurlCommand(sample, 'posix');
    expect(cmd).toContain(`curl -X POST`);
    expect(cmd).toContain(`-H 'Content-Type: application/json'`);
    expect(cmd).toContain(`-H 'Cookie: sid=123'`);
    expect(cmd).toContain(`--data-raw '{"name":"Jane","note":"it'\\''s fine"}'`);
    expect(cmd).toContain(`'https://example.com/users?active=true'`);
  });

  it('builds powershell curl.exe with stop-parsing', () => {
    const cmd = buildCurlCommand(sample, 'powershell');
    expect(cmd.startsWith('curl.exe --% ')).toBe(true);
    expect(cmd).toContain('-X POST');
    expect(cmd).toContain('-H "Content-Type: application/json"');
    expect(cmd).toContain('-H "Cookie: sid=123"');
    expect(cmd).toContain('--data-raw "{\\"name\\":\\"Jane\\",\\"note\\":\\"it\'s fine\\"}"');
    expect(cmd).toContain('"https://example.com/users?active=true"');
  });

  it('builds cmd curl with doubled quotes', () => {
    const cmd = buildCurlCommand(sample, 'cmd');
    expect(cmd.startsWith('curl ')).toBe(true);
    expect(cmd).toContain('-H "Content-Type: application/json"');
    expect(cmd).toContain('--data-raw "{""name"":""Jane"",""note"":""it\'s fine""}"');
  });

  it('includes certificate flags in all shells', () => {
    const certs = {
      insecure: true,
      caPath: 'C:\\certs\\ca.pem',
      cert: 'C:\\certs\\client.p12',
      certType: 'P12' as const,
    };
    const set = buildCurlCommandSet({method: 'get', url: 'https://secure.example'}, certs);
    expect(set.posix).toContain(`--cacert 'C:\\certs\\ca.pem'`);
    expect(set.posix).toContain('--cert-type P12');
    expect(set.posix).toContain(`--cert 'C:\\certs\\client.p12'`);
    expect(set.powershell).toContain('--cacert "C:\\\\certs\\\\ca.pem"');
    expect(set.powershell).toContain('--cert-type P12');
    expect(set.powershell).toContain('--cert "C:\\\\certs\\\\client.p12"');
    expect(set.cmd).toContain('--cacert "C:\\certs\\ca.pem"');
    expect(set.cmd).toContain('--cert-type P12');
    expect(set.cmd).toContain('--cert "C:\\certs\\client.p12"');
  });

  it('formats a multi-shell reference block', () => {
    const set = buildCurlCommandSet({method: 'get', url: 'https://example.com'});
    const text = formatCurlCommandSet(set);
    expect(text).toContain('# Bash / macOS / Linux / Git Bash / WSL');
    expect(text).toContain('# PowerShell (Windows)');
    expect(text).toContain('# CMD (Windows)');
    expect(text).toContain(`curl 'https://example.com'`);
    expect(text).toContain('curl.exe --%');
  });
});
