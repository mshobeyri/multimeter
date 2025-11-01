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

function extractEndpoint(rawUrl: any): string {
  const raw = String(rawUrl || '').trim();
  if (!raw) {
    return '';
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    try {
      const u = new URL(raw);
      const path = u.pathname || '';
      return path && path.startsWith('/') ? path : '';
    } catch {
      const withoutOrigin = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.+-]*:\/\/[^/]+/, '');
      const onlyPath = withoutOrigin.split(/[?#]/)[0];
      return onlyPath && onlyPath.startsWith('/') ? onlyPath : '';
    }
  } else {
    const onlyPath = raw.split(/[?#]/)[0];
    return onlyPath.startsWith('/') ? onlyPath : '';
  }
}

export interface BuildDocHtmlOptions {
  title?: string;
  description?: string;
  theme?: any;
  logoDataUrl?: string;
}

export function buildDocHtml(apis: any[], opts: BuildDocHtmlOptions = {}): string {
  const { title, description, theme, logoDataUrl } = opts;

  const rows = (apis || []).map((api: any, idx: number) => {
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
        return `${i > 0 ? '<hr class="sep" />' : ''}<div class="example">${nameHtml}${descHtml}${exInputs}</div>`;
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
  .doc-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .doc-head-left { display: flex; align-items: center; gap: 8px; }
    .logo { height: 18px; width: auto; object-fit: contain; }
  .search { margin-left: auto; }
  .search-input { min-width: 220px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: var(--fg); outline: none; }
  .search-input::placeholder { color: var(--muted); }
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
    ${rows || '<div>No APIs found.</div>'}
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
