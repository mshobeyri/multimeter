import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocData } from 'mmt-core/DocData';
import { yamlToAPI } from 'mmt-core/apiParsePack';
import parseYaml from 'mmt-core/markupConvertor';
import { docHtml } from 'mmt-core';
import { readFile, readFileAsDataUrl } from '../vsAPI';

interface DocViewProps { doc: DocData; }

declare global { interface Window { vscode?: { postMessage: (msg: any) => void } } }

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

const DocViewHTML: React.FC<DocViewProps> = ({ doc }) => {
  const [html, setHtml] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sources = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(doc.sources)) list.push(...doc.sources);
    const anyDoc = doc as any;
    if (Array.isArray(anyDoc.files)) list.push(...anyDoc.files);
    if (Array.isArray(anyDoc.folders)) list.push(...anyDoc.folders);
    return list;
  }, [doc]);

  const docTitle = doc.title;
  const docDescription = (doc as any).description;
  const docLogo = doc.logo;
  const docServices = (doc as any).services;
  const docSources = Array.isArray((doc as any).sources) ? (doc as any).sources : undefined;
  const docHtmlOpts = (doc as any).html;
  const docEnv = (doc as any).env;

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
      const services = Array.isArray(docServices) ? docServices as Array<{ sources?: string[] }> : [];
      for (const svc of services) {
        const svcSources = Array.isArray(svc.sources) ? svc.sources : [];
        for (const entry of svcSources) {
          if (!entry) continue;
          if (entry.toLowerCase().endsWith('.mmt')) {
            fileSet.add(entry);
          } else {
            try { (await listFiles(entry, true)).forEach(p => fileSet.add(p)); } catch { }
          }
        }
      }
      const apis: any[] = [];
      for (const file of Array.from(fileSet)) {
        try {
          const text = await readFile(file);
          const parsed = parseYaml(text) as any;
          if (parsed && parsed.type === 'api') {
            const api = yamlToAPI(text) as any;
            api.__file = file;
            apis.push(api);
          }
        } catch { }
      }
      let logoDataUrl: string | undefined = undefined;
      if (docLogo && typeof docLogo === 'string') {
        const logoStr = docLogo as string;
        const isData = logoStr.startsWith('data:');
        const isHttp = /^https?:\/\//i.test(logoStr);
        if (!isData && !isHttp) {
          try { logoDataUrl = await readFileAsDataUrl(logoStr); } catch { }
        } else {
          logoDataUrl = logoStr;
        }
      }
      if (!cancelled) setHtml(docHtml.buildDocHtml(apis, {
        title: docTitle,
        description: docDescription,
        logo: logoDataUrl || docLogo,
        sources: docSources,
        services: Array.isArray(docServices) ? docServices : undefined,
        html: docHtmlOpts,
        env: docEnv,
      }));
    })();
    return () => { cancelled = true; };
  }, [sources, docTitle, docDescription, docLogo, docServices, docSources, docHtmlOpts, docEnv]);

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
        <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px' }}>
          Export as HTML
        </button>
      </div>
      <br />
      <iframe ref={iframeRef} style={{ flex: 1, width: '100%', height: '100%', border: '1px solid var(--panel-border)' }} title="Documentation Preview" />
    </div>
  );
};

export default DocViewHTML;
