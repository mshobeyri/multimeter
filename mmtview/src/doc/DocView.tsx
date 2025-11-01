import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocData } from 'mmt-core/DocData';
import { yamlToAPI } from 'mmt-core/apiParsePack';
import parseYaml from 'mmt-core/markupConvertor';
import { readFile } from '../vsAPI';

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

function renderApisToHtml(apis: any[], title?: string, description?: string): string {
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

    const rows = apis.map((api, idx) => {
        const method = String(api.method || '').toUpperCase();
        const badge = method ? `<span class="badge method-${method.toLowerCase()}">${method}</span>` : '';
        const headers = api.headers && Object.keys(api.headers).length ? renderValueList(api.headers) : '';
        const query = api.query && Object.keys(api.query).length ? renderValueList(api.query) : '';
        const cookies = api.cookies && Object.keys(api.cookies).length ? renderValueList(api.cookies) : '';
        let body = '';
        if (api.body !== undefined && api.body !== null && String(api.body).length) {
            const parsedBody = typeof api.body === 'string' ? (tryParseJson(api.body) ?? api.body) : api.body;
            body = renderValueList(parsedBody);
        }
        const examples = api.examples && Array.isArray(api.examples) && api.examples.length
            ? `<div><h3>Examples</h3><ul>${(api.examples as any[]).map((ex: any) => `<li>${renderValueList(typeof ex === 'string' ? (tryParseJson(ex) ?? ex) : ex)}</li>`).join('')}</ul></div>`
            : '';
        const tags = api.tags && api.tags.length ? `<div style="margin-top: 8px; color: var(--muted);">Tags: ${api.tags.join(', ')}</div>` : '';
        const ttl = api.title || `${method} ${api.url}`;
        const desc = api.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
        const output = api.output ? renderValueList(typeof api.output === 'string' ? (tryParseJson(api.output) ?? api.output) : api.output) : '';
        const inputs = api.inputs ? renderValueList(typeof api.inputs === 'string' ? (tryParseJson(api.inputs) ?? api.inputs) : api.inputs) : '';
        const inputsList = [
            headers ? `<li><strong>Headers:</strong> ${headers}</li>` : '',
            query ? `<li><strong>Query:</strong> ${query}</li>` : '',
            cookies ? `<li><strong>Cookies:</strong> ${cookies}</li>` : '',
            body ? `<li><strong>Body (${api.format || 'json'}):</strong> ${body}</li>` : '',
            inputs ? `<li><strong>Inputs:</strong> ${inputs}</li>` : ''
        ].filter(Boolean).join('\n');
        const details = headers || query || cookies || body || examples || output ? `
			<div class="details" id="details-${idx}" style="display: none;">
				<h3>URL</h3>
				<div class="url"><input type="text" id="url-${idx}" value="${escapeHtml(api.url || '')}" style="width: 100%; padding: 4px; box-sizing: border-box;" /></div>
				<h3>Inputs</h3>
				<ul>
					${inputsList}
				</ul>
				<div class="send-section">
					<button onclick="sendRequest(${idx}, '${method}')" style="padding: 6px 12px; margin-top: 8px;">Send Request</button>
				</div>
				<h3>Outputs</h3>
				<div id="response-${idx}" class="response" style="margin-top: 8px; padding: 8px; background: #0b0b0b; border-radius: 4px;">${output}</div>
				${examples}
				${tags}
			</div>` : '';
        return `
			<section class="api" id="api-${idx}">
				<h2 onclick="toggleDetails(${idx})" style="cursor: pointer;">
					<span class="toggle" id="toggle-${idx}">▶</span>
					${badge}<span class="title">${escapeHtml(ttl)}</span>
				</h2>
				${desc}
				${details}
			</section>`;
    }).join('\n');

    return `<!DOCTYPE html>
	<html><head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(title || 'Documentation')}</title>
	<style>
            html, body { height: 100%; }
        :root { --fg: #ddd; --bg: #1e1e1e; --muted: #aaa; --accent: #0e639c; }
            body { margin: 0; padding: 12px; font-size: 12px; line-height: 1.4; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--fg); box-sizing: border-box; }
            h1 { margin: 0 0 6px; font-size: 16px; }
            .doc-desc { color: var(--muted); margin: 0 0 8px; white-space: pre-wrap; }
        .api { width: 100%; border: 1px solid #333; border-radius: 6px; padding: 10px; margin: 10px 0; background: #111; box-sizing: border-box; }
        h2 { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 0 0 6px; }
        .title { font-weight: 600; }
        .toggle { color: var(--muted); }
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
        .details input[type="text"] { font-size: 12px; padding: 4px 6px; }
        .response { width: 100%; box-sizing: border-box; min-height: 20px; }
	</style>
		</head><body>
			<h1>${escapeHtml(title || 'Documentation')}</h1>
			${description ? `<div class="doc-desc">${escapeHtml(description)}</div>` : ''}
		${rows || '<div>No APIs found.</div>'}
		<script>
			function toggleDetails(idx) {
				const details = document.getElementById('details-' + idx);
				const toggle = document.getElementById('toggle-' + idx);
				if (details.style.display === 'none') {
					details.style.display = 'block';
					toggle.textContent = '▼';
				} else {
					details.style.display = 'none';
					toggle.textContent = '▶';
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
            if (!cancelled) setHtml(renderApisToHtml(apis, doc.title, (doc as any).description));
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
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column'}}>
            <div style={{ display: 'flex', justifyContent: 'flex-end'}}>
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