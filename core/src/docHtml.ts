import { DOC_TEMPLATE_HTML } from './docTemplate';
// Shared HTML renderer for documentation pages
// Framework-free and safe to use in Node and browser contexts

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
}

// Attempt to parse JSON strings to objects for richer rendering
function tryParseJson(s: any): any | null {
  if (typeof s !== 'string') {
    return null;
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function renderValueList(val: any): string {
  if (val === undefined || val === null) {
    return '';
  }
  if (typeof val === 'string') {
    const parsed = tryParseJson(val);
    if (parsed && typeof parsed === 'object') {
      return renderValueList(parsed);
    }
    return `<span class=\"value\">${escapeHtml(val)}</span>`;
  }
  if (typeof val !== 'object') {
    return `<span class=\"value\">${escapeHtml(String(val))}</span>`;
  }
  if (Array.isArray(val)) {
    if (!val.length) {
      return '<ul><li><em>empty</em></li></ul>';
    }
    return `<ul>` + val.map((v) => `<li>${renderValueList(v)}</li>`).join('') + `</ul>`;
  }
  const keys = Object.keys(val as Record<string, any>);
  if (!keys.length) {
    return '<ul><li><em>empty</em></li></ul>';
  }
  return `<ul>` + keys.map((k) => `<li><strong>${escapeHtml(k)}:</strong> ${renderValueList((val as any)[k])}</li>`).join('') + `</ul>`;
}

export function extractEndpoint(rawUrl: any): string {
  const raw = String(rawUrl || '').trim();
  if (!raw) { return ''; }
  // Trim query string first
  const qIndex = raw.indexOf('?');
  const base = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  // If scheme present, skip past scheme and host to first '/'
  const schemeIdx = base.indexOf('://');
  let start = -1;
  if (schemeIdx >= 0) {
    const afterHost = base.indexOf('/', schemeIdx + 3);
    start = afterHost; // may be -1
  } else {
    // No scheme, use first '/'
    start = base.indexOf('/');
  }
  if (start < 0) { return ''; }
  // Collapse multiple leading slashes in the path to a single '/'
  const pathPortion = base.slice(start);
  const collapsed = '/' + pathPortion.replace(/^\/+/, '');
  return collapsed;
}

export interface BuildDocHtmlOptions {
  title?: string;
  description?: string;
  theme?: any;
  logoDataUrl?: string;
  sources?: string[];
  services?: Array<{ name?: string; description?: string; sources?: string[] }>;
}

function cleanPath(p: string): string {
  const x = String(p || '').replace(/\\/g, '/');
  return x.replace(/^\.\/+/, ''); // strip leading ./
}
function matchesSource(filePath: string, src: string): boolean {
  const fp = cleanPath(filePath);
  const s = cleanPath(src);
  if (!fp || !s) { return false; }
  if (/\.mmt$/i.test(s)) {
    return fp.endsWith(s) || fp === s;
  }
  // directory prefix match (ensure trailing slash on src)
  const sDir = s.endsWith('/') ? s : s + '/';
  return fp.startsWith(sDir) || fp.includes('/' + sDir) || fp.includes(sDir);
}

export function buildDocHtml(apis: any[], opts: BuildDocHtmlOptions = {}): string {
  const { title, description, theme, logoDataUrl } = opts;

  // ensure unique IDs across the entire page, even when rendering per-group
  let rowIdCounter = 0;
  const makeRows = (list: any[]) => (list || []).map((api: any) => {
    const idx = rowIdCounter++;
    let method = String(api?.method || '').toUpperCase();
    const urlStr = String(api?.url || '');
    if (!method) {
      if (/^wss?:/i.test(urlStr)) method = 'WS';
      else if (urlStr) method = 'GET';
    }
    if (/^WS|WEBSOCKET$/i.test(String(api?.method || ''))) method = 'WS';
    const methodClass = (method || '').toLowerCase().startsWith('ws') ? 'ws' : (method || '').toLowerCase();
    const badge = method ? `<span class="badge method-${methodClass}">${method}</span>` : '';
    const headers = api?.headers && Object.keys(api.headers).length ? renderValueList(api.headers) : '';
    const cookies = api?.cookies && Object.keys(api.cookies).length ? renderValueList(api.cookies) : '';
    let body = '';
    if (api?.body !== undefined && api?.body !== null && String(api.body).length) {
      const rawBody = api.body;
      const parsed = typeof rawBody === 'string' ? tryParseJson(rawBody) : rawBody;
      const isJsonObject = parsed && typeof parsed === 'object';
      if (isJsonObject) {
        body = `<pre class="code">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
      } else {
        body = `<span class="value">${escapeHtml(typeof rawBody === 'string' ? rawBody : String(rawBody))}</span>`;
      }
    }
    const examplesHtml = api?.examples && Array.isArray(api.examples) && api.examples.length
      ? (api.examples as any[]).map((ex: any, i: number) => {
        const obj = typeof ex === 'string' ? (tryParseJson(ex) ?? { description: ex }) : ex;
        const nameHtml = obj?.name ? `<div class="ex-name">${escapeHtml(String(obj.name))}</div>` : '';
        const descHtml = obj?.description ? `<div class="ex-desc">${escapeHtml(String(obj.description))}</div>` : '';
        const exInputs = obj?.inputs ? renderValueList(typeof obj.inputs === 'string' ? (tryParseJson(obj.inputs) ?? obj.inputs) : obj.inputs) : '';
        const exOutputs = obj?.outputs ? renderValueList(typeof obj.outputs === 'string' ? (tryParseJson(obj.outputs) ?? obj.outputs) : obj.outputs) : '';
        const ioBlocks = [
          exInputs ? `<div class="ex-sub"><strong>Inputs</strong>${exInputs}</div>` : '',
          exOutputs ? `<div class="ex-sub"><strong>Outputs</strong>${exOutputs}</div>` : ''
        ].filter(Boolean).join('');
        return `${i > 0 ? '<hr class=\"sep\" />' : ''}<div class=\"example\">${nameHtml}${descHtml}${ioBlocks}</div>`;
      }).join('')
      : '';
    const tags = api?.tags && api.tags.length ? `<div class=\"tags\">${api.tags.map((t: string) => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>` : '';
    const endpoint = extractEndpoint(api?.url);
    const desc = api?.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
    const outputSource = (api as any)?.outputs !== undefined ? (api as any).outputs : (api as any)?.output;
    const output = outputSource ? renderValueList(typeof outputSource === 'string' ? (tryParseJson(outputSource) ?? outputSource) : outputSource) : '';
    const inputs = api?.inputs ? renderValueList(typeof api.inputs === 'string' ? (tryParseJson(api.inputs) ?? api.inputs) : api.inputs) : '';
    const query = (api as any)?.query ? renderValueList(typeof (api as any).query === 'string' ? (tryParseJson((api as any).query) ?? (api as any).query) : (api as any).query) : '';
    const metaHtml = [
      headers ? `<h3>Headers</h3>${headers}` : '',
      cookies ? `<h3>Cookies</h3>${cookies}` : '',
      body ? `<h3>Body (${api?.format || 'json'})</h3>${body}` : ''
    ].filter(Boolean).join('');
    const hasInputs = !!inputs;
    const hasQuery = !!query;
    const hasOutputs = !!output;
    const hasMeta = !!metaHtml;
    const hasExamples = !!examplesHtml;
    const details = hasInputs || hasQuery || hasOutputs || hasMeta || hasExamples ? `
      <div class="details" id="details-${idx}" style="display: none;">
        <h3>URL</h3>
        <div class="url"><input class="url-input" type="text" id="url-${idx}" value="${escapeHtml(api?.url || '')}" /></div>
        ${desc}
        ${tags}
        ${hasQuery ? `<h3>Query</h3><div class="query-block">${query}</div>` : ''}
        ${hasInputs ? `<h3>Inputs</h3><div class="inputs-block">${inputs}</div>` : ''}
        ${hasOutputs ? `<h3>Outputs</h3><div id="response-${idx}" class="response" style="margin-top: 8px; padding: 8px; border-radius: 4px;">${output}</div>` : ''}
        ${hasMeta ? `<hr class="sep" />${metaHtml}` : ''}
        ${hasExamples ? `<hr class="sep" />\n<h3>Examples</h3>\n${examplesHtml}` : ''}
      </div>` : '';
    return `
      <section class="api" id="api-${idx}">
        <h2 onclick="toggleDetails(${idx})" style="cursor: pointer;">
          <span class="toggle" id="toggle-${idx}" role="button" aria-expanded="false" aria-controls="details-${idx}">
            <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18"></polyline>
            </svg>
          </span>
          ${badge}
          ${api?.title ? `<span class="fade-title">${escapeHtml(api.title)}</span>` : ''}
          ${endpoint ? `<span class="endpoint">${escapeHtml(endpoint)}</span>` : ''}
        </h2>
        ${details}
      </section>`;
  }).join('\n');

  const colors = (theme && theme.colors) ? theme.colors : {};
  const logo = logoDataUrl || (theme && theme.logo ? String(theme.logo) : '');
  const cssFg = colors.fg || '#ddd';
  const cssBg = colors.bg || '#1e1e1e';
  const cssMuted = colors.muted || '#aaa';
  const cssAccent = colors.accent || '#0e639c';
  const cssCard = colors.card || '#111';
  const cssBorder = colors.border || '#333';

  // Build groups if services/sources provided and file info exists
  let contentHtml = '';
  const anyServices = Array.isArray(opts.services) && opts.services.length > 0;
  const anySources = Array.isArray(opts.sources) && opts.sources.length > 0;
  if ((anyServices || anySources) && (apis || []).some(a => (a as any).__file)) {
    type Group = { title: string; description?: string; items: any[] };
    const groups: Group[] = [];
    const taken = new Set<string>();
    const listApis = (apis || []) as any[];
    if (anyServices) {
      for (const svc of opts.services || []) {
        const svcSources = (svc?.sources || []) as string[];
        // pick only items matching this service AND not already assigned to a previous service
        const items = listApis.filter(a => {
          const f = String((a as any).__file || '');
          if (!f || taken.has(f)) { return false; }
          return svcSources.some(s => matchesSource(f, s));
        });
        items.forEach(a => taken.add(String((a as any).__file)));
        groups.push({ title: String(svc?.name || 'Service'), description: svc?.description, items });
      }
    }
    // If only top-level sources (no services), render rows inline (no group header)
    if (!anyServices && anySources) {
      const items = listApis.filter(a => {
        const f = String((a as any).__file || '');
        return (opts.sources as string[]).some(s => matchesSource(f, s));
      });
      contentHtml = makeRows(items);
    } else {
      // When services exist, render service groups; top-level sources are rendered inline before groups (no "Ungrouped" group)
      let topHtml = '';
      if (anySources) {
        const items = listApis.filter(a => {
          const f = String((a as any).__file || '');
          return !taken.has(f) && (opts.sources as string[]).some(s => matchesSource(f, s));
        });
        if (items.length) { topHtml = makeRows(items); }
      }
      const groupsHtml = groups.map((g, gi) => `
        <section class="group" id="group-${gi}">
          <h2 class="group-title">${escapeHtml(g.title)} <span class="count">(${g.items.length})</span></h2>
          ${g.description ? `<div class="group-desc">${escapeHtml(g.description)}</div>` : ''}
          ${makeRows(g.items)}
        </section>
      `).join('\n');
      contentHtml = topHtml + groupsHtml;
    }
  } else {
    contentHtml = makeRows(apis || []);
  }

  // Use embedded HTML template (generated at build time) and inject content.
  if (DOC_TEMPLATE_HTML && DOC_TEMPLATE_HTML.length > 0) {
    let html = DOC_TEMPLATE_HTML;
    // Replace <title>...</title>
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title || 'API Documentation')}</title>`);
    // Replace description block
    const descHtml = `<div class="doc-desc">${escapeHtml(description || 'Generated API Documentation')}</div>`;
    html = html.replace(/<div class="doc-desc">[\s\S]*?<\/div>/i, descHtml);
      // Inject generated API content but preserve existing <script> (interactivity) inside container.
      // Strategy: locate the container, then the first <script> tag within it, and inject before that script.
      const containerRegex = /<div class="doc-container">([\s\S]*?)<\/div>/i;
      const match = containerRegex.exec(html);
      if (match) {
        const containerInner = match[1];
        // Find script block inside original container to keep it.
        const scriptMatch = /(<script[\s\S]*?<\/script>)/i.exec(containerInner);
        const originalScript = scriptMatch ? scriptMatch[1] : '';
        // Remove existing script from inner before injecting content
        const withoutScript = originalScript ? containerInner.replace(originalScript, '') : containerInner;
        // Remove existing (now replaced) description from inner to avoid duplication
        const withoutDesc = withoutScript.replace(/<div class="doc-desc">[\s\S]*?<\/div>/i, '');
        const newInner = `\n${descHtml}\n${contentHtml || '<div>No APIs found.</div>'}\n${originalScript}`;
        html = html.replace(containerRegex, `<div class="doc-container">${newInner}</div>`);
      }
      // Theme override: if custom theme colors provided, append style tag overriding CSS variables.
      const hasCustomColors = theme && theme.colors;
      if (hasCustomColors) {
        const themeCss = `:root {${cssFg?`--fg:${cssFg};`:''}${cssBg?`--bg:${cssBg};`:''}${cssMuted?`--muted:${cssMuted};`:''}${cssAccent?`--accent:${cssAccent};`:''}${cssCard?`--card:${cssCard};`:''}${cssBorder?`--border:${cssBorder};`:''}}`;
        // Insert before closing </head>
        html = html.replace(/<\/head>/i, `<style id="dynamic-theme">${themeCss}</style></head>`);
      }
      // Logo injection: replace existing <h1> block if logo provided.
      if (logo) {
        html = html.replace(/<div class="doc-head-left">[\s\S]*?<\/div>/i, `<div class="doc-head-left">${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="logo" style="height:24px;object-fit:contain;" />` : ''}<h1>${escapeHtml(title || 'API Documentation')}</h1></div>`);
      }
    return html;
  }

  return `<!DOCTYPE html>
  <html><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title || 'Documentation')}</title>
  <style>
    html, body { height: 100%; }
    :root { --fg: ${cssFg}; --bg: ${cssBg}; --muted: ${cssMuted}; --accent: ${cssAccent}; --card: ${cssCard}; --border: ${cssBorder}; }
    body { margin: 0; padding: 12px; font-size: 12px; line-height: 1.4; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--fg); box-sizing: border-box; }
    h1 { margin: 0 0 6px; font-size: 16px; }
    .doc-desc { color: var(--muted); margin: 0 0 8px; white-space: pre-wrap; }
  </style>
  </head><body>
    <h1>${escapeHtml(title || 'Documentation')}</h1>
    ${description ? `<div class="doc-desc">${escapeHtml(description)}</div>` : ''}
    ${contentHtml || '<div>No APIs found.</div>'}
  </body></html>`;
}

export default { buildDocHtml };
