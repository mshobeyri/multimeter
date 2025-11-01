import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocData } from 'mmt-core/DocData';
import { yamlToAPI } from 'mmt-core/apiParsePack';
import parseYaml from 'mmt-core/markupConvertor';
import { readFile, readFileAsDataUrl } from '../vsAPI';

interface DocViewProps {
    doc: DocData;
}

declare global {
    interface Window { vscode?: { postMessage: (msg: any) => void } }
}

async function listFiles(folder: string, recursive = true): Promise<string[]> {
    return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg && msg.command === 'listFilesResult' && msg.folder === folder) {
                window.removeEventListener('message', handler);
                resolve(Array.isArray(msg.files) ? msg.files : []);
            }
        };
        window.addEventListener('message', handler);
        window.vscode?.postMessage({ command: 'listFiles', folder, recursive });
    });
}

function escapeHtml(s: string): string {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
}

function renderApisToHtml(apis: any[], title?: string, description?: string, theme?: any, logoDataUrl?: string): string {
    // Helper: try to parse JSON strings to objects for better bullet rendering
    const tryParseJson = (s: any): any | null => {
        if (typeof s !== 'string') return null;
        try { return JSON.parse(s); } catch { return null; }
    };

    // Helper: render any JS value as nested bullet-point list HTML
    const renderValueList = (val: any): string => {
        if (val === undefined || val === null) return '';
        if (typeof val === 'string') {
            const parsed = tryParseJson(val);
            if (parsed && typeof parsed === 'object') return renderValueList(parsed);
            return `<span class="value">${escapeHtml(val)}</span>`;
        }
        if (typeof val !== 'object') {
            return `<span class="value">${escapeHtml(String(val))}</span>`;
        }
        if (Array.isArray(val)) {
            if (!val.length) return '<ul><li><em>empty</em></li></ul>';
            return `<ul>` + val.map((v) => `<li>${renderValueList(v)}</li>`).join('') + `</ul>`;
        }
        const keys = Object.keys(val as Record<string, any>);
        if (!keys.length) return '<ul><li><em>empty</em></li></ul>';
        return `<ul>` + keys.map((k) => `<li><strong>${escapeHtml(k)}:</strong> ${renderValueList((val as any)[k])}</li>`).join('') + `</ul>`;
    };

    // Helper: extract endpoint path from a URL or path string
    // - Removes scheme/host if present
    // - Strips query string and hash
    // - Returns only values that start with '/'; otherwise returns '' to hide
    const extractEndpoint = (rawUrl: any): string => {
        const raw = String(rawUrl || '').trim();
        if (!raw) return '';
        // If it looks like a full URL, use URL parsing to get pathname
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
            try {
                const u = new URL(raw);
                const path = u.pathname || '';
                return path && path.startsWith('/') ? path : '';
            } catch {
                // Fallback: strip scheme/host manually
                const withoutOrigin = raw.replace(/^[a-zA-Z][a-zA-Z0-9+.+-]*:\/\/[^/]+/, '');
                const onlyPath = withoutOrigin.split(/[?#]/)[0];
                return onlyPath && onlyPath.startsWith('/') ? onlyPath : '';
            }
        } else {
            // Not a full URL; treat as path or template; drop query/hash
            const onlyPath = raw.split(/[?#]/)[0];
            return onlyPath.startsWith('/') ? onlyPath : '';
        }
    };

    const rows = apis.map((api, idx) => {
        const method = String(api.method || '').toUpperCase();
        const badge = method ? `<span class="badge method-${method.toLowerCase()}">${method}</span>` : '';
        const headers = api.headers && Object.keys(api.headers).length ? renderValueList(api.headers) : '';
        const cookies = api.cookies && Object.keys(api.cookies).length ? renderValueList(api.cookies) : '';
        let body = '';
        if (api.body !== undefined && api.body !== null && String(api.body).length) {
            const rawBody = api.body;
            const parsed = typeof rawBody === 'string' ? tryParseJson(rawBody) : rawBody;
            const isJsonObject = parsed && typeof parsed === 'object';
            if (isJsonObject) {
                body = `<pre class="code">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
            } else {
                body = `<span class="value">${escapeHtml(typeof rawBody === 'string' ? rawBody : String(rawBody))}</span>`;
            }
        }
        const examplesHtml = api.examples && Array.isArray(api.examples) && api.examples.length
            ? (api.examples as any[]).map((ex: any, i: number) => {
                const obj = typeof ex === 'string' ? (tryParseJson(ex) ?? { description: ex }) : ex;
                const nameHtml = obj?.name ? `<div class="ex-name">${escapeHtml(String(obj.name))}</div>` : '';
                const descHtml = obj?.description ? `<div class="ex-desc">${escapeHtml(String(obj.description))}</div>` : '';
                const exInputs = obj?.inputs ? renderValueList(typeof obj.inputs === 'string' ? (tryParseJson(obj.inputs) ?? obj.inputs) : obj.inputs) : '';
                return `${i > 0 ? '<hr class="sep" />' : ''}<div class="example">${nameHtml}${descHtml}${exInputs}</div>`;
            }).join('')
            : '';
        const tags = api.tags && api.tags.length ? `<div class="tags">${api.tags.map((t: string) => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>` : '';
    const ttl = api.title || `${method} ${api.url}`;
    const endpoint = extractEndpoint(api.url);
        const desc = api.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
        const outputSource = (api as any).outputs !== undefined ? (api as any).outputs : (api as any).output;
        const output = outputSource ? renderValueList(typeof outputSource === 'string' ? (tryParseJson(outputSource) ?? outputSource) : outputSource) : '';
        const inputs = api.inputs ? renderValueList(typeof api.inputs === 'string' ? (tryParseJson(api.inputs) ?? api.inputs) : api.inputs) : '';
        const metaHtml = [
            headers ? `<h3>Headers</h3>${headers}` : '',
            cookies ? `<h3>Cookies</h3>${cookies}` : '',
            body ? `<h3>Body (${api.format || 'json'})</h3>${body}` : ''
        ].filter(Boolean).join('');
                const hasInputs = !!inputs;
                const hasOutputs = !!output;
                const hasMeta = !!metaHtml;
                const hasExamples = !!examplesHtml;
                const details = hasInputs || hasOutputs || hasMeta || hasExamples ? `
			<div class="details" id="details-${idx}" style="display: none;">
				<h3>URL</h3>
                                <div class="url"><input class="url-input" type="text" id="url-${idx}" value="${escapeHtml(api.url || '')}" /></div>
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
                    ${api.title ? `<span class="fade-title">${escapeHtml(api.title)}</span>` : ''}
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
        .doc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .logo { height: 18px; width: auto; object-fit: contain; }
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
			${logo ? `<div class="doc-header"><img class="logo" src="${escapeHtml(logo)}" alt="logo" /><h1>${escapeHtml(title || 'Documentation')}</h1></div>` : `<h1>${escapeHtml(title || 'Documentation')}</h1>`}
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
        </script>
	</body></html>`;
}

const DocView: React.FC<DocViewProps> = ({ doc }) => {
    const [html, setHtml] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const sources = useMemo(() => {
        const list: string[] = [];
        if (Array.isArray(doc.sources)) list.push(...doc.sources);
        // legacy fallback if files/folders accidentally exist
        const anyDoc = doc as any;
        if (Array.isArray(anyDoc.services)) {
            for (const svc of anyDoc.services) {
                if (Array.isArray(svc?.sources)) list.push(...svc.sources);
            }
        }
        if (Array.isArray(anyDoc.files)) list.push(...anyDoc.files);
        if (Array.isArray(anyDoc.folders)) list.push(...anyDoc.folders);
        return list;
    }, [doc]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const fileSet = new Set<string>();
            for (const entry of sources) {
                if (!entry) continue;
                if (entry.toLowerCase().endsWith('.mmt')) {
                    fileSet.add(entry);
                } else {
                    try { (await listFiles(entry, true)).forEach(p => fileSet.add(p)); } catch { }
                }
            }
            const apis: any[] = [];
            for (const file of Array.from(fileSet)) {
                try {
                    const text = await readFile(file);
                    const parsed = parseYaml(text) as any;
                    if (parsed && parsed.type === 'api') { apis.push(yamlToAPI(text)); }
                } catch { }
            }
            // Prepare logo as data URL if theme.logo is a relative path or file path
            let logoDataUrl: string | undefined = undefined;
            const theme: any = (doc as any).theme;
            if (theme && theme.logo && typeof theme.logo === 'string') {
                const logoStr = theme.logo as string;
                const isData = logoStr.startsWith('data:');
                const isHttp = /^https?:\/\//i.test(logoStr);
                if (!isData && !isHttp) {
                    try {
                        logoDataUrl = await readFileAsDataUrl(logoStr);
                    } catch { /* ignore */ }
                }
            }
            if (!cancelled) setHtml(renderApisToHtml(apis, doc.title, (doc as any).description, (doc as any).theme, logoDataUrl));
        })();
        return () => { cancelled = true; };
    }, [sources, doc.title]);

    useEffect(() => {
        if (!iframeRef.current) return;
        const d = iframeRef.current.contentDocument;
        if (!d) return;
        d.open();
        d.write(html || '');
        d.close();
    }, [html]);

    const handleExport = () => {
        window.vscode?.postMessage({ command: 'exportHtml', html, title: doc.title || 'documentation' });
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleExport}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 12px"
                    }}>
                    Export as HTML
                </button>
            </div>
            <iframe ref={iframeRef} style={{ flex: 1, width: '100%', height: '100%', border: '1px solid var(--panel-border)' }} title="Documentation Preview" />
        </div >
    );
};

export default DocView;