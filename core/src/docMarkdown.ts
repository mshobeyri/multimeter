import {extractEndpoint} from './docHtml';

export interface BuildDocMdOptions {
  title?: string;
  description?: string;
  theme?: any;
  logoDataUrl?: string;
  sources?: string[];
  services?: Array<{name?: string; description?: string; sources?: string[]}>;
}

function cleanPath(p: string): string {
  const x = String(p || '').replace(/\\/g, '/');
  return x.replace(/^\.\/+/, '');
}

function matchesSource(filePath: string, src: string): boolean {
  const fp = cleanPath(filePath);
  const s = cleanPath(src);
  if (!fp || !s) {
    return false;
  }
  if (/\.mmt$/i.test(s)) {
    return fp.endsWith(s) || fp === s;
  }
  const sDir = s.endsWith('/') ? s : s + '/';
  return fp.startsWith(sDir) || fp.includes('/' + sDir) || fp.includes(sDir);
}

function fence(code: string, lang = ''): string {
  const safe = String(code ?? '').replace(/```/g, '\u0060\u0060\u0060');
  return '```' + lang + '\n' + safe + '\n```';
}

function renderKV(obj: any): string {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      parts.push(`- ${k}:`);
      const inner = renderKV(v);
      if (inner) {
        parts.push(inner.split('\n').map(l => (l ? '  ' + l : l)).join('\n'));
      }
    } else {
      parts.push(`- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }
  return parts.join('\n');
}

export function buildDocMarkdown(
    apis: any[], opts: BuildDocMdOptions = {}): string {
  const title = opts.title || 'Documentation';
  const lines: string[] = [];
  lines.push(`# ${title}`);
  if (opts.description) {
    lines.push('', opts.description);
  }

  const anyServices = Array.isArray(opts.services) && opts.services.length > 0;
  const anySources = Array.isArray(opts.sources) && opts.sources.length > 0;

  const listApis = (apis || []) as any[];
  const taken = new Set<string>();

  const renderApi = (api: any) => {
    const method = String(api?.method || '').toUpperCase();
    const endpoint = extractEndpoint(api?.url);
    const hdr =
        [
          '###', method ? `**${method}**` : '', api?.title ? api.title : '',
          endpoint ? '`' + endpoint + '`' : ''
        ].filter(Boolean)
            .join(' ');
    lines.push('', hdr);
    if (api?.description) {
      lines.push('', api.description);
    }
    if (api?.tags && api.tags.length) {
      lines.push(
          '', `Tags: ${api.tags.map((t: string) => `\`${t}\``).join(', ')}`);
    }
    if (api?.url) {
      lines.push('', `URL: \`${String(api.url)}\``);
    }
    if (api?.inputs) {
      lines.push('', '#### Inputs', '', renderKV(api.inputs));
    }
    const outputSource = (api as any)?.outputs !== undefined ?
        (api as any).outputs :
        (api as any)?.output;
    if (outputSource) {
      lines.push('', '#### Outputs', '', renderKV(outputSource));
    }
    if (api?.headers && Object.keys(api.headers).length) {
      lines.push('', '#### Headers', '', renderKV(api.headers));
    }
    if (api?.cookies && Object.keys(api.cookies).length) {
      lines.push('', '#### Cookies', '', renderKV(api.cookies));
    }
    if (api?.body !== undefined && api?.body !== null &&
        String(api.body).length) {
      const bodyStr = typeof api.body === 'string' ?
          api.body :
          JSON.stringify(api.body, null, 2);
      lines.push('', '#### Body', '', fence(bodyStr, 'json'));
    }
    if (api?.examples && Array.isArray(api.examples) && api.examples.length) {
      lines.push('', '#### Examples');
      (api.examples as any[]).forEach((ex: any) => {
        const obj = typeof ex === 'string' ? {description: ex} : ex;
        const exTitle = obj?.name ? String(obj.name) : 'Example';
        lines.push('', `##### ${exTitle}`);
        if (obj?.description) { lines.push('', obj.description); }
        if (obj?.inputs) { lines.push('', renderKV(obj.inputs)); }
      });
    }
  };

  const renderList = (arr: any[]) => {
    arr.forEach(renderApi);
  };

  if ((anyServices || anySources) && listApis.some(a => (a as any).__file)) {
    if (anySources && !anyServices) {
      const items = listApis.filter(a => {
        const f = String((a as any).__file || '');
        return (opts.sources as string[]).some(s => matchesSource(f, s));
      });
      renderList(items);
    } else {
      if (anySources) {
        const items = listApis.filter(a => {
          const f = String((a as any).__file || '');
          return !taken.has(f) &&
              (opts.sources as string[]).some(s => matchesSource(f, s));
        });
        items.forEach(a => taken.add(String((a as any).__file)));
        renderList(items);
      }
      for (const svc of opts.services || []) {
        const svcSources = (svc?.sources || []) as string[];
        const items = listApis.filter(a => {
          const f = String((a as any).__file || '');
          if (!f || taken.has(f)) {
            return false;
          }
          return svcSources.some(s => matchesSource(f, s));
        });
        if (!items.length) {
          continue;
        }
    lines.push(
      '', `## ${String(svc?.name || 'Service')} (${items.length})`);
        if (svc?.description) {
          lines.push('', svc.description);
        }
        items.forEach(a => taken.add(String((a as any).__file)));
        renderList(items);
      }
    }
  } else {
    renderList(listApis);
  }

  return lines.join('\n');
}

export default {buildDocMarkdown};
