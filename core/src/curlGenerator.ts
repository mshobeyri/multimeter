export type CurlShellKind = 'posix' | 'powershell' | 'cmd';

export interface CurlCertificateOptions {
  insecure?: boolean;
  caPath?: string;
  certType?: 'P12';
  cert?: string;
  key?: string;
  pass?: string;
}

export interface CurlRequestInput {
  method?: string;
  url: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  body?: unknown;
}

type CurlPart =
  | {kind: 'flag'; text: string} |
  {kind: 'pair'; flag: string; value: string} |
  {kind: 'url'; value: string};

export interface CurlCommandSet {
  posix: string;
  powershell: string;
  cmd: string;
}

function stringifyCurlValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return String(value);
}

function stringifyCurlBody(body: unknown): string {
  if (body === undefined || body === null || body === '') {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body);
}

export function buildCurlUrl(url: string, query: Record<string, unknown>): string {
  const queryPairs = Object.entries(query)
      .map(([key, value]) => [key, stringifyCurlValue(value)] as const)
      .filter(([, value]) => value);
  if (!queryPairs.length) {
    return url;
  }

  try {
    const parsed = new URL(url);
    queryPairs.forEach(([key, value]) => parsed.searchParams.set(key, value));
    return parsed.toString();
  } catch {
    const params = new URLSearchParams();
    queryPairs.forEach(([key, value]) => params.set(key, value));
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }
}

function buildCurlParts(
    input: CurlRequestInput,
    certificates?: CurlCertificateOptions): CurlPart[] {
  const parts: CurlPart[] = [];
  const method = String(input.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    parts.push({kind: 'pair', flag: '-X', value: method});
  }

  Object.entries(input.headers || {}).forEach(([key, value]) => {
    const headerValue = stringifyCurlValue(value);
    if (headerValue) {
      parts.push({kind: 'pair', flag: '-H', value: `${key}: ${headerValue}`});
    }
  });

  const cookiePairs = Object.entries(input.cookies || {})
      .map(([key, value]) => {
        const cookieValue = stringifyCurlValue(value);
        return cookieValue ? `${key}=${cookieValue}` : '';
      })
      .filter(Boolean);
  if (cookiePairs.length) {
    parts.push({
      kind: 'pair',
      flag: '-H',
      value: `Cookie: ${cookiePairs.join('; ')}`,
    });
  }

  const body = stringifyCurlBody(input.body);
  if (method !== 'GET' && body) {
    parts.push({kind: 'pair', flag: '--data-raw', value: body});
  }

  const url = buildCurlUrl(input.url || '', input.query || {});
  if (!url) {
    return parts;
  }

  if (certificates?.insecure) {
    parts.push({kind: 'flag', text: '--insecure'});
  }
  if (certificates?.caPath) {
    parts.push({kind: 'pair', flag: '--cacert', value: certificates.caPath});
  }
  if (certificates?.certType === 'P12' && certificates.cert) {
    parts.push({kind: 'pair', flag: '--cert-type', value: 'P12'});
    parts.push({kind: 'pair', flag: '--cert', value: certificates.cert});
  } else if (certificates?.cert && certificates.key) {
    parts.push({kind: 'pair', flag: '--cert', value: certificates.cert});
    parts.push({kind: 'pair', flag: '--key', value: certificates.key});
    if (certificates.pass) {
      parts.push({kind: 'pair', flag: '--pass', value: certificates.pass});
    }
  }

  parts.push({kind: 'url', value: url});
  return parts;
}

export function quoteCurlArgument(shell: CurlShellKind, value: string): string {
  if (shell === 'powershell') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (shell === 'cmd') {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function quoteNativeWindows(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function shouldQuoteCurlPairValue(flag: string): boolean {
  return flag !== '-X' && flag !== '--request' && flag !== '--cert-type';
}

function formatPairValue(
    shell: CurlShellKind,
    flag: string,
    value: string): string {
  if (!shouldQuoteCurlPairValue(flag)) {
    return value;
  }
  if (shell === 'powershell') {
    return quoteNativeWindows(value);
  }
  return quoteCurlArgument(shell, value);
}

function renderPosixLine(parts: CurlPart[]): string {
  const segments: string[] = [];
  for (const part of parts) {
    if (part.kind === 'flag') {
      segments.push(part.text);
      continue;
    }
    if (part.kind === 'pair') {
      segments.push(part.flag, formatPairValue('posix', part.flag, part.value));
      continue;
    }
    segments.push(quoteCurlArgument('posix', part.value));
  }
  return ['curl', ...segments].join(' ');
}

function renderPosixParts(parts: CurlPart[], multiline: boolean): string {
  if (!multiline) {
    return renderPosixLine(parts);
  }
  const chunks: string[] = [];
  for (const part of parts) {
    if (part.kind === 'flag') {
      chunks.push(part.text);
      continue;
    }
    if (part.kind === 'pair') {
      chunks.push(`${part.flag} ${formatPairValue('posix', part.flag, part.value)}`);
      continue;
    }
    chunks.push(quoteCurlArgument('posix', part.value));
  }
  const lines = [`curl ${chunks[0]}`];
  for (let i = 1; i < chunks.length; i++) {
    lines.push(`  ${chunks[i]}`);
  }
  return lines.map((line, index) => index < lines.length - 1 ? `${line} \\` : line).join('\n');
}

function renderCmdParts(parts: CurlPart[]): string {
  const segments: string[] = [];
  for (const part of parts) {
    if (part.kind === 'flag') {
      segments.push(part.text);
      continue;
    }
    if (part.kind === 'pair') {
      segments.push(part.flag, formatPairValue('cmd', part.flag, part.value));
      continue;
    }
    segments.push(quoteCurlArgument('cmd', part.value));
  }
  return ['curl', ...segments].join(' ');
}

function renderPowerShellParts(parts: CurlPart[]): string {
  const args: string[] = [];
  for (const part of parts) {
    if (part.kind === 'flag') {
      args.push(part.text);
      continue;
    }
    if (part.kind === 'pair') {
      args.push(part.flag, formatPairValue('powershell', part.flag, part.value));
      continue;
    }
    args.push(quoteNativeWindows(part.value));
  }
  return `curl.exe --% ${args.join(' ')}`;
}

export function buildCurlCommand(
    input: CurlRequestInput,
    shell: CurlShellKind,
    certificates?: CurlCertificateOptions): string {
  const parts = buildCurlParts(input, certificates);
  if (shell === 'powershell') {
    return renderPowerShellParts(parts);
  }
  if (shell === 'cmd') {
    return renderCmdParts(parts);
  }
  return renderPosixParts(parts, false);
}

export function buildCurlCommandSet(
    input: CurlRequestInput,
    certificates?: CurlCertificateOptions): CurlCommandSet {
  const parts = buildCurlParts(input, certificates);
  return {
    posix: renderPosixParts(parts, true),
    powershell: renderPowerShellParts(parts),
    cmd: renderCmdParts(parts),
  };
}

export function formatCurlCommandSet(set: CurlCommandSet): string {
  return [
    '# Bash / macOS / Linux / Git Bash / WSL',
    set.posix,
    '',
    '# PowerShell (Windows)',
    '# Use curl.exe — "curl" is an alias for Invoke-WebRequest',
    set.powershell,
    '',
    '# CMD (Windows)',
    set.cmd,
  ].join('\n');
}
