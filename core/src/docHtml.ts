import { DOC_TEMPLATE_HTML } from './docTemplate';
import { formatBody } from './markupConvertor';
import { resolveEnvTokenValues } from './variableReplacer';
// Shared HTML renderer for documentation pages
// Framework-free and safe to use in Node and browser contexts

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
}

function highlightSyntax(escaped: string, fmt: string): string {
  if (fmt === 'xml') {
    return escaped
      .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="hl-tag">$2</span>')
      .replace(/\b([\w:-]+)(=)(&quot;[^&]*&quot;)/g, '<span class="hl-attr">$1</span>$2<span class="hl-str">$3</span>');
  }
  if (fmt !== 'json') { return escaped; }
  return escaped
    .replace(/(&quot;)((?:[^&]|&(?!quot;))*)(&quot;)\s*:/g, '<span class="hl-key">$1$2$3</span>:')
    .replace(/:[ ]*(&quot;)((?:[^&]|&(?!quot;))*)(&quot;)/g, ': <span class="hl-str">$1$2$3</span>')
    .replace(/(&quot;)((?:[^&]|&(?!quot;))*)(&quot;)/g, '<span class="hl-str">$1$2$3</span>')
    .replace(/\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g, '<span class="hl-num">$1</span>')
    .replace(/\b(true|false)\b/g, '<span class="hl-bool">$1</span>')
    .replace(/\bnull\b/g, '<span class="hl-null">null</span>');
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

function isNonEmpty(val: any): boolean {
  if (val === undefined || val === null) {
    return false;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) {
      return false;
    }
    const parsed = tryParseJson(val);
    if (parsed && typeof parsed === 'object') {
      return isNonEmpty(parsed);
    }
    return true;
  }
  if (typeof val !== 'object') {
    return true;
  }
  if (Array.isArray(val)) {
    return val.length > 0 && val.some(v => isNonEmpty(v));
  }
  const keys = Object.keys(val as Record<string, any>);
  if (!keys.length) {
    return false;
  }
  return keys.some(k => isNonEmpty((val as any)[k]));
}

function renderParamTable(obj: any, valueHeader = 'Default'): string {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  const entries = Object.entries(obj);
  if (!entries.length) {
    return '';
  }
  const rows = entries.map(([k, v]) => {
    const val = typeof v === 'string' ? escapeHtml(v) : escapeHtml(JSON.stringify(v));
    return `          <tr>
            <td class="param-name">${escapeHtml(k)}</td>
            <td class="param-value">${val}</td>
          </tr>`;
  }).join('\n');
  return `      <table class="param-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>${escapeHtml(valueHeader)}</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
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
  logo?: string;
  sources?: string[];
  services?: Array<{ name?: string; description?: string; sources?: string[] }>;
  html?: { triable?: boolean; cors_proxy?: string };
  env?: Record<string, string>;
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

function resolveInputDefaults(str: string, inputs: any): string {
  if (!str || !inputs || typeof inputs !== 'object') { return str; }
  let result = str;
  for (const [k, v] of Object.entries(inputs)) {
    const val = String(v);
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp('i:' + escaped, 'g'), val);
    result = result.replace(new RegExp('\\{' + escaped + '\\}', 'g'), val);
  }
  return result;
}

export function resolveEnvVars(str: string, env: Record<string, string>): string {
  if (!str || !env || typeof env !== 'object') { return str; }
  return resolveEnvTokenValues(str, env);
}

function resolveEnvInValue(val: any, env: Record<string, string>): any {
  if (!env || !Object.keys(env).length) { return val; }
  if (typeof val === 'string') { return resolveEnvTokenValues(val, env); }
  if (Array.isArray(val)) { return val.map(v => resolveEnvInValue(v, env)); }
  if (val && typeof val === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = resolveEnvInValue(v, env);
    }
    return out;
  }
  return val;
}

export function resolveEnvInApi(api: any, env: Record<string, string>): any {
  if (!env || !Object.keys(env).length) { return api; }
  const copy = { ...api };
  if (typeof copy.url === 'string') { copy.url = resolveEnvTokenValues(copy.url, env); }
  if (copy.headers) { copy.headers = resolveEnvInValue(copy.headers, env); }
  if (copy.cookies) { copy.cookies = resolveEnvInValue(copy.cookies, env); }
  if (copy.query) { copy.query = resolveEnvInValue(copy.query, env); }
  if (copy.inputs) { copy.inputs = resolveEnvInValue(copy.inputs, env); }
  if (typeof copy.body === 'string') { copy.body = resolveEnvTokenValues(copy.body, env); }
  if (typeof copy.description === 'string') { copy.description = resolveEnvTokenValues(copy.description, env); }
  if (copy.examples && Array.isArray(copy.examples)) {
    copy.examples = copy.examples.map((ex: any) => resolveEnvInValue(ex, env));
  }
  return copy;
}

function renderEditableKV(obj: any, idPrefix: string): string {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  const entries = Object.entries(obj);
  return entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    return `<div class="try-kv-row"><input value="${escapeHtml(k)}" placeholder="Key" /><input value="${escapeHtml(val)}" placeholder="Value" /><button class="try-kv-remove" onclick="this.parentElement.remove()" type="button">\u00d7</button></div>`;
  }).join('');
}

export function buildDocHtml(apis: any[], opts: BuildDocHtmlOptions = {}): string {
  const { logo } = opts;
  const tryItEnabled = opts.html?.triable !== false;
  const corsProxy = opts.html?.cors_proxy || '';
  const env = opts.env;

  // Resolve e:xxx in doc-level title/description
  const title = (env && opts.title) ? resolveEnvVars(opts.title, env) : opts.title;
  const description = (env && opts.description) ? resolveEnvVars(opts.description, env) : opts.description;

  // Resolve e:xxx environment placeholders once across all APIs
  const resolvedApis = (env && Object.keys(env).length)
    ? (apis || []).map(a => resolveEnvInApi(a, env))
    : (apis || []);

  // ensure unique IDs across the entire page, even when rendering per-group
  let rowIdCounter = 0;
  // Collect metadata for Try It panels
  const tryApiMetaList: any[] = [];

  const makeRows = (list: any[]) => (list || []).map((api: any) => {
    const idx = rowIdCounter++;
    let method = api.protocol === "ws" ? "WS":  String(api?.method || '').toUpperCase();
    const urlStr = String(api?.url || '');
    const methodClass = (method || '').toLowerCase().startsWith('ws') ? 'ws' : (method || '').toLowerCase();
    const badge = method ? `<span class="badge method-${methodClass}">${method}</span>` : '';
    const headers = api?.headers && Object.keys(api.headers).length ? renderParamTable(api.headers, 'Default') : '';
    const cookies = api?.cookies && Object.keys(api.cookies).length ? renderParamTable(api.cookies, 'Default') : '';
    // Compute body string once – used for both detail panel and Try panel
    const fmtRaw = String(api?.format || 'json').toLowerCase();
    const fmt = (fmtRaw === 'xml' || fmtRaw === 'json' || fmtRaw === 'text') ? fmtRaw : 'json';
    let bodyStr = '';
    if (api?.body !== undefined && api?.body !== null && String(api.body).length) {
      try {
        bodyStr = formatBody(fmt as any, api.body, true);
      } catch {
        bodyStr = typeof api.body === 'string' ? api.body : String(api.body);
      }
    }
    const bodyResolved = resolveInputDefaults(bodyStr, api?.inputs);
    let body = '';
    if (bodyResolved) {
      if (fmt === 'json' || fmt === 'xml') {
        body = `<pre class="code">${highlightSyntax(escapeHtml(bodyResolved), fmt)}</pre>`;
      } else {
        body = `<span class="value">${escapeHtml(bodyResolved)}</span>`;
      }
    }
    const examplesHtml = api?.examples && Array.isArray(api.examples) && api.examples.length
      ? (api.examples as any[]).map((ex: any, i: number) => {
        const obj = typeof ex === 'string' ? (tryParseJson(ex) ?? { description: ex }) : ex;
        const nameHtml = obj?.name ? `<div class="ex-name">${escapeHtml(String(obj.name))}</div>` : '';
        const descHtml = obj?.description ? `<div class="ex-desc">${escapeHtml(String(obj.description))}</div>` : '';
        const exInputs = obj?.inputs ? renderParamTable(typeof obj.inputs === 'string' ? (tryParseJson(obj.inputs) ?? obj.inputs) : obj.inputs, 'Default') : '';
        const exOutputs = obj?.outputs ? renderParamTable(typeof obj.outputs === 'string' ? (tryParseJson(obj.outputs) ?? obj.outputs) : obj.outputs, 'Default') : '';
        const exTryBtn = tryItEnabled ? `<button class="try-btn-sm" onclick="tryExample(${idx}, ${i}, event)" type="button">Try</button>` : '';
        const ioBlocks = [
          exInputs ? `<div class="ex-sub"><strong>Inputs</strong>${exInputs}</div>` : '',
          exOutputs ? `<div class="ex-sub"><strong>Outputs</strong>${exOutputs}</div>` : ''
        ].filter(Boolean).join('');
        return `${i > 0 ? '<hr class=\"sep\" />' : ''}<div class=\"example\">${exTryBtn}${nameHtml}${descHtml}${ioBlocks}</div>`;
      }).join('')
      : '';
    const tags = api?.tags && api.tags.length ? `<div class=\"tags\">${api.tags.map((t: string) => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>` : '';
    const endpoint = extractEndpoint(api?.url);
    const desc = api?.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
    const outputSource = (api as any)?.outputs !== undefined ? (api as any).outputs : (api as any)?.output;
    const output = outputSource ? renderParamTable(typeof outputSource === 'string' ? (tryParseJson(outputSource) ?? outputSource) : outputSource, 'Path') : '';
    const inputs = api?.inputs ? renderParamTable(typeof api.inputs === 'string' ? (tryParseJson(api.inputs) ?? api.inputs) : api.inputs, 'Default') : '';
    const queryObj = (api as any)?.query;
    const query = isNonEmpty(queryObj) ? renderParamTable(typeof queryObj === 'string' ? (tryParseJson(queryObj) ?? queryObj) : queryObj, 'Default') : '';
    const metaHtml = [
      headers ? `<h3>Headers</h3>${headers}` : '',
      cookies ? `<h3>Cookies</h3>${cookies}` : '',
      body ? `<h3>Body (${api?.format || 'JSON'})</h3>${body}` : ''
    ].filter(Boolean).join('');
    const hasInfo = !!desc || !!tags || !!headers || !!cookies;
    const hasInputs = !!inputs;
    const hasQuery = isNonEmpty(queryObj);
    const hasOutputs = !!output;
    const hasMeta = !!metaHtml;
    const hasExamples = !!examplesHtml;
    const details = hasInfo || hasInputs || hasQuery || hasOutputs || hasMeta || hasExamples ? `
      <div class="details" id="details-${idx}" style="display: none;">
        <h3>URL</h3>
        <div class="url"><input class="url-input" type="text" id="url-${idx}" value="${escapeHtml(api?.url || '')}" /></div>
        ${desc}
        ${tags}
        ${hasQuery ? `<h3>Query</h3>${query}` : ''}
        ${hasInputs ? `<h3>Inputs</h3>${inputs}` : ''}
        ${hasOutputs ? `<h3>Outputs</h3>${output}` : ''}
        ${hasMeta ? `<hr class="sep" />${metaHtml}` : ''}
        ${hasExamples ? `<hr class="sep" />\n<h3>Examples</h3>\n${examplesHtml}` : ''}
      </div>` : '';

    // Build Try It panel
    let tryPanel = '';
    const isWs = api?.protocol === 'ws' || urlStr.startsWith('ws://') || urlStr.startsWith('wss://');
    if (tryItEnabled) {
      const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        .map(m => `<option value="${m}" ${m === method ? 'selected' : ''}>${m}</option>`)
        .join('');
      const headersKV = renderEditableKV(api?.headers, `try-headers-${idx}`);
      const queryKV = renderEditableKV(
        typeof queryObj === 'string' ? (tryParseJson(queryObj) ?? {}) : (queryObj || {}),
        `try-query-${idx}`
      );
      const hasQueryKV = isNonEmpty(queryObj);

      const methodRow = isWs ? '' : `
            <h3>Method</h3>
            <select id="try-method-${idx}">${methodOptions}</select>`;
      const queryRow = hasQueryKV && !isWs ? `<h3>Query Parameters</h3><div class="try-kv" id="try-query-${idx}">${queryKV}</div><button class="try-add-btn" onclick="addKVRow('try-query-${idx}')" type="button">+ Add Query Param</button>` : '';
      const bodyLabel = isWs ? 'Message' : 'Body';
      const showBody = isWs || bodyResolved || method === 'POST' || method === 'PUT' || method === 'PATCH';
      const bodyRow = showBody ? `<h3>${bodyLabel}</h3><textarea class="try-body" id="try-body-${idx}" rows="6">${escapeHtml(bodyResolved)}</textarea>` : '';
      const buttonsRow = isWs
        ? `<div class="try-ws-btns">
            <button class="try-ws-connect" id="try-ws-connect-${idx}" onclick="wsToggleConnect(${idx})" type="button">Connect</button>
            <button class="try-ws-send" id="try-ws-send-${idx}" onclick="wsSendMessage(${idx})" type="button" disabled>Send</button>
            <button class="try-ws-clear" id="try-ws-clear-${idx}" onclick="wsClearMessages(${idx})" type="button">Clear</button>
          </div>`
        : `<div><button class="try-send-btn" onclick="sendTryRequest(${idx})" type="button">Send</button></div>`;

      tryPanel = `
      <div class="try-panel" id="try-panel-${idx}" style="display:none;">
        <div class="try-panel-inner">
          <div class="try-form">
            <h3>URL</h3>
            <input type="text" id="try-url-${idx}" value="${escapeHtml(urlStr)}" />${methodRow}
            ${queryRow}
            <h3>Headers</h3>
            <div class="try-kv" id="try-headers-${idx}">${headersKV}</div>
            <button class="try-add-btn" onclick="addKVRow('try-headers-${idx}')" type="button">+ Add Header</button>
            ${bodyRow}
            ${buttonsRow}
          </div>
          <div class="try-response" id="try-response-${idx}"></div>
        </div>
      </div>`;

      // Collect metadata for the JS runtime
      tryApiMetaList[idx] = {
        method: method || 'GET',
        url: urlStr,
        headers: api?.headers || {},
        body: api?.body || null,
        format: api?.format || 'json',
        inputs: api?.inputs || {},
        query: queryObj || {},
        examples: (api?.examples || []).map((ex: any) => {
          const obj = typeof ex === 'string' ? (tryParseJson(ex) ?? {}) : ex;
          return { name: obj?.name, inputs: obj?.inputs || {} };
        }),
        cors_proxy: corsProxy,
        protocol: isWs ? 'ws' : 'http',
      };
    }

    const tryBtn = tryItEnabled ? `<button class="try-btn" id="try-btn-${idx}" onclick="toggleTryPanel(${idx}, event)" type="button">Try</button>` : '';
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
          ${tryBtn}
        </h2>
        ${details}
        ${tryPanel}
      </section>`;
  }).join('\n');

  const logoStr = logo || '';
  const cssFg = '#ddd';
  const cssBg = '#1e1e1e';
  const cssMuted = '#aaa';
  const cssAccent = '#0e639c';
  const cssCard = '#111';
  const cssBorder = '#333';

  // Build groups if services/sources provided and file info exists
  let contentHtml = '';
  const anyServices = Array.isArray(opts.services) && opts.services.length > 0;
  const anySources = Array.isArray(opts.sources) && opts.sources.length > 0;
  if ((anyServices || anySources) && resolvedApis.some(a => (a as any).__file)) {
    type Group = { title: string; description?: string; items: any[] };
    const groups: Group[] = [];
    const taken = new Set<string>();
    const listApis = resolvedApis as any[];
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
          <br /><br />
          <h2 class="group-title">${escapeHtml(g.title)} </h2>
          ${g.description ? `<div class="desc">${escapeHtml(g.description)}</div>` : ''}
          ${makeRows(g.items)}
        </section>
      `).join('\n');
      contentHtml = topHtml + groupsHtml;
    }
  } else {
    contentHtml = makeRows(resolvedApis);
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
      // Logo injection: replace existing <h1> block if logo provided.
      if (logoStr) {
        html = html.replace(/<div class="doc-head-left">[\s\S]*?<\/div>/i, `<div class="doc-head-left"><img class="logo" src="${escapeHtml(logoStr)}" alt="logo" style="height:24px;object-fit:contain;" /><h1>${escapeHtml(title || 'API Documentation')}</h1></div>`);
      }
      // Inject Try It metadata script before closing </body> when enabled
      if (tryItEnabled && tryApiMetaList.length) {
        const metaJson = JSON.stringify(tryApiMetaList);
        const metaScript = `<script>window.__tryApiMeta = ${metaJson};</script>`;
        html = html.replace('</body>', `${metaScript}\n</body>`);
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
    body { margin: 0; padding: 0; font-size: 12px; line-height: 1.4; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--fg); box-sizing: border-box; display: flex; min-height: 100vh; flex-direction: column; }
    .doc-container { padding: 12px; flex: 1 0 auto; }
    .doc-footer { margin-top: auto; padding: 12px; text-align: center; color: var(--muted); border-top: 1px solid ${cssBorder}; background: rgba(255,255,255,0.02); }
    h1 { margin: 0 0 6px; font-size: 16px; }
    .doc-desc { color: var(--muted); margin: 0 0 8px; white-space: pre-wrap; }
  </style>
  </head><body>
    <div class="doc-container">
      <h1>${escapeHtml(title || 'Documentation')}</h1>
      ${description ? `<div class="doc-desc">${escapeHtml(description)}</div>` : ''}
      ${contentHtml || '<div>No APIs found.</div>'}
    </div>
    <footer class="doc-footer">Powered by Multimeter</footer>
  </body></html>`;
}

export default { buildDocHtml };
