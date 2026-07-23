/** Detected display format for request/response body preview. */
export type BodyPreviewFormat = 'json' | 'xml' | 'urlencoded' | 'text';

function headerValue(
  headers: Record<string, any> | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value == null ? undefined : String(value);
    }
  }
  return undefined;
}

/** Infer body format from Content-Type and/or body text. */
export function detectBodyFormat(
  body: string,
  headers?: Record<string, any>,
): BodyPreviewFormat {
  const contentType = (headerValue(headers, 'content-type') || '').toLowerCase();
  if (contentType.includes('json')) {
    return 'json';
  }
  if (contentType.includes('xml') || contentType.includes('html')) {
    return 'xml';
  }
  if (contentType.includes('urlencoded') || contentType.includes('x-www-form-urlencoded')) {
    return 'urlencoded';
  }

  const trimmed = (body || '').trimStart();
  if (!trimmed) {
    return 'text';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(body);
      return 'json';
    } catch {
      // fall through
    }
  }
  if (trimmed.startsWith('<')) {
    return 'xml';
  }
  if (/^[^=&\s]+=/.test(trimmed) && trimmed.includes('=') && !trimmed.includes('\n')) {
    return 'urlencoded';
  }
  return 'text';
}

/** Whether the body can be pretty-printed. */
export function canBeautifyBody(
  body: string,
  headers?: Record<string, any>,
): boolean {
  const format = detectBodyFormat(body, headers);
  if (format === 'json') {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  }
  return format === 'xml' || format === 'urlencoded';
}

function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const parts = xml.replace(/(>)(<)/g, '$1\n$2').split('\n');
  for (const raw of parts) {
    const node = raw.trim();
    if (!node) {
      continue;
    }
    if (node.startsWith('</')) {
      indent = Math.max(indent - 1, 0);
    }
    formatted += '  '.repeat(indent) + node + '\n';
    if (
      node.startsWith('<') &&
      !node.startsWith('</') &&
      !node.startsWith('<?') &&
      !node.endsWith('/>') &&
      !node.includes('</')
    ) {
      indent++;
    }
  }
  return formatted.trimEnd();
}

function formatUrlEncoded(body: string): string {
  return body
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) {
        return decodeURIComponent(part.replace(/\+/g, ' '));
      }
      const key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
      const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
      return `${key}=${value}`;
    })
    .join('\n');
}

/** Pretty-print body when possible; otherwise return original. */
export function beautifyBody(
  body: string,
  headers?: Record<string, any>,
): string {
  const format = detectBodyFormat(body, headers);
  try {
    if (format === 'json') {
      return JSON.stringify(JSON.parse(body), null, 2);
    }
    if (format === 'xml') {
      return formatXml(body);
    }
    if (format === 'urlencoded') {
      return formatUrlEncoded(body);
    }
  } catch {
    // leave raw
  }
  return body;
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function span(cls: string, text: string): string {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

function highlightJson(text: string): string {
  // Tokenize strings, numbers, keywords, and punctuation.
  // Keep whitespace after strings in its own group so newlines before `}` are preserved.
  const re =
    /("(?:\\.|[^"\\])*")(\s*)(:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],])/g;
  let out = '';
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      out += escapeHtml(text.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      out += span(match[3] ? 'bh-key' : 'bh-string', match[1]);
      if (match[2]) {
        out += escapeHtml(match[2]);
      }
      if (match[3]) {
        out += span('bh-punct', match[3]);
      }
    } else if (match[4] !== undefined) {
      out += span('bh-number', match[4]);
    } else if (match[5] !== undefined) {
      out += span('bh-keyword', match[5]);
    } else if (match[6] !== undefined) {
      out += span('bh-punct', match[6]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    out += escapeHtml(text.slice(last));
  }
  return out;
}

function highlightXml(text: string): string {
  const re =
    /(<!--[\s\S]*?-->)|(<\?[\s\S]*?\?>)|(<\/?[A-Za-z_][\w:.-]*)|(\/?>)|(=)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([^<\s="'\/]+)/g;
  let out = '';
  let last = 0;
  let inTag = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      out += escapeHtml(text.slice(last, match.index));
    }
    if (match[1]) {
      out += span('bh-comment', match[1]);
    } else if (match[2]) {
      out += span('bh-tag', match[2]);
    } else if (match[3]) {
      inTag = true;
      out += span('bh-tag', match[3]);
    } else if (match[4]) {
      inTag = false;
      out += span('bh-punct', match[4]);
    } else if (match[5]) {
      out += span('bh-punct', match[5]);
    } else if (match[6]) {
      out += span('bh-string', match[6]);
    } else if (match[7]) {
      out += span(inTag ? 'bh-attr' : 'bh-text', match[7]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    out += escapeHtml(text.slice(last));
  }
  return out;
}

function highlightUrlEncoded(text: string): string {
  return text
    .split(/(\n|&)/)
    .map((part) => {
      if (part === '\n' || part === '&') {
        return span('bh-punct', part);
      }
      if (!part) {
        return '';
      }
      const eq = part.indexOf('=');
      if (eq < 0) {
        return span('bh-key', part);
      }
      return (
        span('bh-key', part.slice(0, eq)) +
        span('bh-punct', '=') +
        span('bh-string', part.slice(eq + 1))
      );
    })
    .join('');
}

/** Escape and syntax-color body text as HTML (safe for dangerouslySetInnerHTML). */
export function highlightBodyHtml(
  body: string,
  headers?: Record<string, any>,
): string {
  const format = detectBodyFormat(body, headers);
  if (format === 'json') {
    return highlightJson(body);
  }
  if (format === 'xml') {
    return highlightXml(body);
  }
  if (format === 'urlencoded') {
    return highlightUrlEncoded(body);
  }
  return escapeHtml(body);
}
