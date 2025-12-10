import React, { useEffect, useMemo, useState } from 'react';
import { DocData } from 'mmt-core/DocData';
import { yamlToAPI } from 'mmt-core/apiParsePack';
import parseYaml from 'mmt-core/markupConvertor';
import * as mmtcore from 'mmt-core';
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

const DocViewMarkdown: React.FC<DocViewProps> = ({ doc }) => {
  const [md, setMd] = useState('');
  

  const sources = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(doc.sources)) list.push(...doc.sources);
    const anyDoc = doc as any;
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
      const anyDoc: any = doc as any;
      const services = Array.isArray(anyDoc.services) ? anyDoc.services as Array<{ sources?: string[] }> : [];
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
      const theme: any = (doc as any).theme;
      if (theme && theme.logo && typeof theme.logo === 'string') {
        const logoStr = theme.logo as string;
        const isData = logoStr.startsWith('data:');
        const isHttp = /^https?:\/\//i.test(logoStr);
        if (!isData && !isHttp) {
          try { logoDataUrl = await readFileAsDataUrl(logoStr); } catch {}
        }
      }
  if (!cancelled) setMd((mmtcore as any).docMarkdown.buildDocMarkdown(apis, {
        title: doc.title,
        description: (doc as any).description,
        theme: (doc as any).theme,
        logoDataUrl,
        sources: Array.isArray(doc.sources) ? doc.sources : undefined,
        services: Array.isArray((doc as any).services) ? (doc as any).services : undefined,
      }));
    })();
    return () => { cancelled = true; };
  }, [sources, doc.title, (doc as any).description, (doc as any).theme, (doc as any).services]);

  const handleExport = () => {
    window.vscode?.postMessage({ command: 'exportMarkdown', markdown: md, title: doc.title || 'documentation' });
  };

  const handleOpenPreview = () => {
    window.vscode?.postMessage({ command: 'openMarkdownPreview', markdown: md, title: doc.title || 'documentation' });
  };

  

  return (
    <div style={{ height: 'calc(100vh - 100px)', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <div />
        <div>
          <button onClick={handleOpenPreview} style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px' }}>Show Preview</button>
          <button onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px' }}>Export as Markdown</button>
        </div>
      </div>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: 8,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}
      >{md}</pre>
    </div>
  );
};

export default DocViewMarkdown;
