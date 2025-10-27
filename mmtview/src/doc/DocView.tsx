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
	const rows = apis.map((api, idx) => {
		const method = String(api.method || '').toUpperCase();
		const badge = method ? `<span class="badge method-${method.toLowerCase()}">${method}</span>` : '';
		const headers = api.headers && Object.keys(api.headers).length
			? `<pre class="kv">${escapeHtml(JSON.stringify(api.headers, null, 2))}</pre>`
			: '';
		const query = api.query && Object.keys(api.query).length
			? `<pre class="kv">${escapeHtml(JSON.stringify(api.query, null, 2))}</pre>`
			: '';
		const cookies = api.cookies && Object.keys(api.cookies).length
			? `<pre class="kv">${escapeHtml(JSON.stringify(api.cookies, null, 2))}</pre>`
			: '';
		const body = api.body !== undefined && api.body !== null && String(api.body).length
			? `<pre class="code">${escapeHtml(typeof api.body === 'string' ? api.body : JSON.stringify(api.body, null, 2))}</pre>`
			: '';
		const ttl = api.title || `${method} ${api.url}`;
		const desc = api.description ? `<div class="desc">${escapeHtml(api.description)}</div>` : '';
		return `
			<section class="api" id="api-${idx}">
				<h2>${badge}<span class="title">${escapeHtml(ttl)}</span></h2>
				${desc}
				<div class="url">${escapeHtml(api.url || '')}</div>
				<div class="meta">
					${headers ? `<div><h3>Headers</h3>${headers}</div>` : ''}
					${query ? `<div><h3>Query</h3>${query}</div>` : ''}
					${cookies ? `<div><h3>Cookies</h3>${cookies}</div>` : ''}
					${body ? `<div><h3>Body (${api.format || 'json'})</h3>${body}</div>` : ''}
				</div>
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
			body { margin: 0; padding: 16px; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--fg); box-sizing: border-box; }
			h1 { margin: 0 0 8px; font-size: 20px; }
			.doc-desc { color: var(--muted); margin: 0 0 12px; white-space: pre-wrap; }
		.api { border: 1px solid #333; border-radius: 6px; padding: 12px; margin: 12px 0; background: #111; }
		h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; margin: 0 0 8px; }
		.title { font-weight: 600; }
		.badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: #444; color: #fff; }
		.method-get { background:#2d7; }
		.method-post { background:#27d; }
		.method-put { background:#d72; }
		.method-patch { background:#a7d; }
		.method-delete { background:#d44; }
		.url { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; color: var(--accent); margin-bottom: 8px; word-break: break-all; }
		.desc { color: var(--muted); margin-bottom: 8px; white-space: pre-wrap; }
		h3 { font-size: 12px; margin: 10px 0 6px; color: #ddd; }
		.kv, .code { background: #0b0b0b; padding: 8px; border-radius: 4px; overflow:auto; border: 1px solid #222; }
	</style>
		</head><body>
			<h1>${escapeHtml(title || 'Documentation')}</h1>
			${description ? `<div class="doc-desc">${escapeHtml(description)}</div>` : ''}
		${rows || '<div>No APIs found.</div>'}
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
					try { (await listFiles(entry, true)).forEach(p => fileSet.add(p)); } catch {}
				}
			}
			const apis: any[] = [];
			for (const file of Array.from(fileSet)) {
				try {
					const text = await readFile(file);
					const parsed = parseYaml(text) as any;
					if (parsed && parsed.type === 'api') { apis.push(yamlToAPI(text)); }
				} catch {}
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

	return (
		<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			<iframe ref={iframeRef} style={{ flex: 1, width: '100%', height: '100%', border: '1px solid var(--panel-border)' }} title="Documentation Preview" />
		</div>
	);
};

export default DocView;