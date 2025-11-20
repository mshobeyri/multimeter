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
    const method = String(api?.method || '').toUpperCase();
    const badge = method ? `<span class="badge method-${method.toLowerCase()}">${method}</span>` : '';
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
    const tags = api?.tags && api.tags.length ? `<div class="tags">${api.tags.map((t: string) => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>` : '';
    const endpoint = extractEndpoint(api?.url);
    const desc = api?.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
    const outputSource = (api as any)?.outputs !== undefined ? (api as any).outputs : (api as any)?.output;
    const output = outputSource ? renderValueList(typeof outputSource === 'string' ? (tryParseJson(outputSource) ?? outputSource) : outputSource) : '';
    const inputs = api?.inputs ? renderValueList(typeof api.inputs === 'string' ? (tryParseJson(api.inputs) ?? api.inputs) : api.inputs) : '';
    const metaHtml = [
      headers ? `<h3>Headers</h3>${headers}` : '',
      cookies ? `<h3>Cookies</h3>${cookies}` : '',
      body ? `<h3>Body (${api?.format || 'json'})</h3>${body}` : ''
    ].filter(Boolean).join('');
    const hasInputs = !!inputs;
    const hasOutputs = !!output;
    const hasMeta = !!metaHtml;
    const hasExamples = !!examplesHtml;
    const details = hasInputs || hasOutputs || hasMeta || hasExamples ? `
      <div class="details" id="details-${idx}" style="display: none;">
        <h3>URL</h3>
        <div class="url"><input class="url-input" type="text" id="url-${idx}" value="${escapeHtml(api?.url || '')}" /></div>
        ${desc}
        ${tags}
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
    /* Sticky header spanning full width with bottom border (horizontal line) */
    .doc-header {
      position: sticky; top: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin: -12px -12px 8px; padding: 8px 12px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      min-height: 40px;
    }
    .doc-head-left { display: flex; align-items: center; gap: 10px; }
    .doc-head-left h1 { margin: 0; font-size: 16px; line-height: 24px; display: flex; align-items: center; }
    .logo { height: 20px; width: auto; object-fit: contain; display: block; }
    .search { margin-left: auto; display: flex; align-items: center; }
    .search-input { min-width: 240px; height: 28px; padding: 0 10px; border-radius: 4px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: var(--fg); outline: none; }
    /* Style the native search cancel (clear) icon to a gray tone matching theme.
       Keep the default appearance so it remains visible. */
    .search-input::-webkit-search-cancel-button {
      height: 14px;
      width: 14px;
      cursor: pointer;
      filter: grayscale(1) brightness(0.85);
      opacity: 0.9;
    }
  .search-input::placeholder { color: var(--muted); }
  .group { margin: 16px 0; }
  .group-title { margin: 12px 0 4px; font-size: 13px; color: var(--muted); border-bottom: 1px solid #2a2a2a; padding-bottom: 4px; }
  .group-desc { color: var(--muted); margin: 0 0 8px; white-space: pre-wrap; }
  .api { width: 100%; border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin: 10px 0; background: var(--card); box-sizing: border-box; }
    h2 { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 0 0 6px; }
    .title { font-weight: 700; }
    .endpoint { font-weight: 400; color: #9aa0a6; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }
    .fade-title { color: var(--muted); font-weight: 700; margin-right: 8px; }
    .toggle { color: var(--muted); display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; }
    .toggle .chevron { transition: transform 0.15s ease; transform: rotate(0deg); }
    .toggle.open .chevron { transform: rotate(90deg); }
    .badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: #444; color: #fff; }
    .method-get { background:#2d7; }
    .method-post { background:#27d; }
    .method-put { background:#d72; }
    .method-patch { background:#a7d; }
    .method-delete { background:#d44; }
    .url { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color: var(--accent); margin-bottom: 6px; word-break: break-all; }
    .desc { color: var(--muted); margin-bottom: 6px; white-space: pre-wrap; }
    h3 { font-size: 11px; margin: 8px 0 4px; color: #ddd; }
    .kv, .code { background: #0b0b0b; padding: 6px; border-radius: 4px; overflow:auto; border: 1px solid #222; }
    .details { width: 100%; }
    .details ul { margin: 0 0 6px 16px; }
    .details li { margin: 2px 0; }
    .details .url-input { width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; padding: 4px 6px; color: #cfcfcf; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 4px; }
    .response { width: 100%; box-sizing: border-box; min-height: 20px; }
    .sep { border: none; border-top: 1px solid #2a2a2a; margin: 8px 0; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
    .tag { display: inline-block; padding: 2px 6px; font-size: 10px; border-radius: 999px; background: #222; border: 1px solid #333; color: #bbb; }
    .example { padding: 4px 0; }
    .ex-name { font-weight: 600; margin-bottom: 2px; }
    .ex-desc { color: var(--muted); margin-bottom: 2px; }
  </style>
  </head><body>
    <div class="doc-header">
      <div class="doc-head-left">
        ${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="logo" />` : ''}
        <h1>${escapeHtml(title || 'Documentation')}</h1>
      </div>
      <div class="search">
        <input id="search-input" class="search-input" type="search" placeholder="Search..." aria-label="Filter endpoints" />
      </div>
    </div>
  ${description ? `<div class="doc-desc">${escapeHtml(description)}</div>` : ''}
  ${contentHtml || '<div>No APIs found.</div>'}
    <script>
      function toggleDetails(idx) {
        const details = document.getElementById('details-' + idx);
        const toggle = document.getElementById('toggle-' + idx);
        const isClosed = details.style.display === 'none';
        if (isClosed) {
          details.style.display = 'block';
          toggle.classList.add('open');
          toggle.setAttribute('aria-expanded', 'true');
        } else {
          details.style.display = 'none';
          toggle.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      }
      (function setUpSearch(){
        var input = document.getElementById('search-input');
        if (!input) return;
        var noResId = 'no-results';
        function applyFilter(){
          var q = (input.value || '').toLowerCase().trim();
          var nodes = Array.prototype.slice.call(document.querySelectorAll('section.api'));
          var any = false;
          for (var i=0;i<nodes.length;i++){
            var sec = nodes[i];
            var text = (sec.textContent || '').toLowerCase();
            var match = !q || text.indexOf(q) !== -1;
            sec.style.display = match ? '' : 'none';
            if (match) any = true;
          }
          // hide entire group blocks with no visible apis
          var groups = Array.prototype.slice.call(document.querySelectorAll('section.group'));
          for (var j=0;j<groups.length;j++){
            var g = groups[j];
            var vis = g.querySelector('section.api[style=""]') || g.querySelector('section.api:not([style])');
            // If no child api is visible, hide the group
            var anyApi = Array.prototype.some.call(g.querySelectorAll('section.api'), function(el){ return el.style.display !== 'none'; });
            g.style.display = anyApi ? '' : 'none';
          }
          var noRes = document.getElementById(noResId);
          if (!q || any) {
            if (noRes && noRes.parentElement) noRes.parentElement.removeChild(noRes);
          } else {
            if (!noRes) {
              var div = document.createElement('div');
              div.id = noResId;
              div.textContent = 'No results';
              div.style.color = '#bbb';
              div.style.margin = '8px 0';
              document.body.appendChild(div);
            }
          }
        }
        input.addEventListener('input', applyFilter);
      })();
    </script>
  </body></html>`;
}

export default { buildDocHtml };
