import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocData } from 'mmt-core/DocData';
import { yamlToAPI } from 'mmt-core/apiParsePack';
import parseYaml from 'mmt-core/markupConvertor';
import { docHtml } from 'mmt-core';
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
    return docHtml.buildDocHtml(apis, { title, description, theme, logoDataUrl });
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