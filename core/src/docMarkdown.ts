import {extractEndpoint, resolveEnvVars, resolveEnvInApi, parseParamDescriptions, extractSources} from './docHtml';
import { formatBody } from './markupConvertor';

export interface BuildDocMdOptions {
  title?: string;
  description?: string;
  logo?: string;
  sources?: string[];
  services?: Array<{name?: string; description?: string; sources?: string[]}>;
  env?: Record<string, string>;
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

interface MdTableOptions {
  paramDescs?: Record<string, string>;
  showDescCol?: boolean;
  showSource?: boolean;
}

function renderTableFromObject(obj: any, valueHeader = 'Default', opts: MdTableOptions = {}): string {
  if (!obj || typeof obj !== 'object') return '';
  const entries = Object.entries(obj);
  if (!entries.length) return '';
  const { paramDescs, showDescCol = false, showSource = false } = opts;
  const hasDescCol = showDescCol || (paramDescs != null && Object.keys(paramDescs).length > 0);
  const hasSrcCol = showSource;
  const rows = entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    const descCol = hasDescCol ? ` ${paramDescs?.[k] || ''}|` : '';
    const srcCol = hasSrcCol ? ` ${extractSources(val)}|` : '';
    return `|${k}| ${val}|${descCol}${srcCol}`;
  });
  const headerDesc = hasDescCol ? 'Description|' : '';
  const sepDesc = hasDescCol ? '-|' : '';
  const headerSrc = hasSrcCol ? 'Source|' : '';
  const sepSrc = hasSrcCol ? '-|' : '';
  return ['|Parameter|'+valueHeader+'|'+headerDesc+headerSrc, '|-|-|'+sepDesc+sepSrc, ...rows].join('\n');
}

export function buildDocMarkdown(
    apis: any[], opts: BuildDocMdOptions = {}): string {
  const env = opts.env;
  const title = (env && opts.title) ? resolveEnvVars(opts.title, env) : (opts.title || 'Documentation');
  const descriptionRaw = opts.description;
  const description = (env && descriptionRaw) ? resolveEnvVars(descriptionRaw, env) : descriptionRaw;
  const lines: string[] = [];
  lines.push(`# ${title || 'Documentation'}`);
  if (description) {
    lines.push('', description);
  }

  const anyServices = Array.isArray(opts.services) && opts.services.length > 0;
  const anySources = Array.isArray(opts.sources) && opts.sources.length > 0;

  // Resolve e:xxx environment placeholders once across all APIs
  const listApis = ((env && Object.keys(env).length)
    ? (apis || []).map(a => resolveEnvInApi(a, env))
    : (apis || [])) as any[];
  const taken = new Set<string>();

  const renderApi = (api: any) => {
    const method = String(api?.method || '').toUpperCase();
    const endpoint = extractEndpoint(api?.url);
    const hdr = [
      '##', method ? `**\`${method}\`**` : '', api?.title ? api.title : '',
      endpoint ? `*\`${endpoint}\`*` : ''
    ].filter(Boolean).join(' ');
    lines.push('', hdr);
    // Parse <<i:xxx>> / <<o:xxx>> annotations from description
    const rawDesc = api?.description || '';
    const { cleaned: cleanedDesc, params: paramDescs } = parseParamDescriptions(rawDesc);
    const hasAnyParamDescs = Object.keys(paramDescs.inputs).length > 0 || Object.keys(paramDescs.outputs).length > 0;
    if (cleanedDesc) {
      // Highlight <<i:xxx>> / <<o:xxx>> references with bold
      const highlighted = cleanedDesc.replace(/<<([io]):(\S+?)>>/g, '**<<$1:$2>>**');
      lines.push('', highlighted);
    }
    if (api?.tags && api.tags.length) {
      lines.push('', `**Tags**: ${api.tags.map((t: string) => `\`${t}\``).join(', ')}`);
    }
    // Parameters section
    lines.push('', '### Parameters');
    if (api?.inputs) { lines.push('', '**Inputs**', renderTableFromObject(api.inputs, 'Default', { paramDescs: paramDescs.inputs, showDescCol: hasAnyParamDescs })); }
    const outputSource = (api as any)?.outputs !== undefined ? (api as any).outputs : (api as any)?.output;
    if (outputSource) { lines.push('', '**Outputs**', renderTableFromObject(outputSource, 'Path', { paramDescs: paramDescs.outputs, showDescCol: hasAnyParamDescs })); }
    lines.push('', '---');
    if (api?.url) { lines.push('', `**URL**: \`${String(api.url)}\``); }
    if (api?.headers && Object.keys(api.headers).length) { lines.push('', '**Headers**', renderTableFromObject(api.headers, 'Default', { showSource: true })); }
    if (api?.cookies && Object.keys(api.cookies).length) { lines.push('', '**Cookies**', renderTableFromObject(api.cookies, 'Default', { showSource: true })); }
    // Body
    if (api?.body !== undefined && api?.body !== null && String(api.body).length) {
      const fmtRaw = String(api?.format || 'json').toLowerCase();
      const lang = (fmtRaw === 'xml' || fmtRaw === 'json' || fmtRaw === 'text') ? fmtRaw : 'json';
      const bodyStr = formatBody(lang as any, api.body, true);
      lines.push('', '**Body**', '', fence(bodyStr, lang === 'text' ? '' : lang));
    }
    // Examples
    if (api?.examples && Array.isArray(api.examples) && api.examples.length) {
      lines.push('', '### Examples');
      (api.examples as any[]).forEach((ex: any) => {
        const obj = typeof ex === 'string' ? { description: ex } : ex;
        const exTitle = obj?.name ? String(obj.name) : 'Example';
        lines.push('', `**${exTitle}**`);
        if (obj?.inputs) { lines.push('', 'Inputs', renderTableFromObject(obj.inputs, 'Default', {})); }
        if (obj?.outputs) { lines.push('', 'Outputs', renderTableFromObject(obj.outputs, 'Default', {})); }
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
        lines.push('', `# ${String(svc?.name || 'Service')}`);
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
