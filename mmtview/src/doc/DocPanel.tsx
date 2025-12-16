import React, { useEffect, useMemo, useRef, useState } from 'react';

import { DocData } from 'mmt-core/DocData';
import DocEdit from './DocEdit';
import { docToYaml, yamlToDoc } from 'mmt-core/docParsePack';
import DocViewHTML from './DocViewHTML';
import DocViewMarkdown from './DocViewMarkdown';


const LAST_DOC_TAB_KEY = "mmtview:doc:lastTab";


interface DocProps {
  content: string;
  setContent: (value: string) => void;
}


const Doc: React.FC<DocProps> = ({ content, setContent }) => {
  const doc = useMemo(() => yamlToDoc(content), [content]);
  const docRef = useRef<DocData>(doc);
  const contentRef = useRef(content);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const setDoc = React.useCallback((next: DocData | ((prev: DocData) => DocData)) => {
    const resolved = typeof next === 'function'
        ? (next as (prev: DocData) => DocData)(docRef.current)
        : next;
    docRef.current = resolved;
    const newYaml = docToYaml(resolved);
    if (newYaml === contentRef.current || newYaml === '') {
      return;
    }
    contentRef.current = newYaml;
    setContent(newYaml);
  }, [setContent]);

  const [tab, setTab] = useState<"edit" | "view" | "md">(
    () => (localStorage.getItem(LAST_DOC_TAB_KEY) as any) || "view"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  localStorage.setItem(LAST_DOC_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) return;

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      const fullTextWidth = 4 * 100;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const update = (patch: Partial<DocData>) => {
    setDoc(prev => ({ ...prev, ...patch }));
  };

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          ref={tabContainerRef}
          className="tab-bar"
        >
          <button
            onClick={() => setTab("edit")}
            className={`tab-button ${tab === "edit" ? "active" : ""}`}
            title={showIconsOnly ? "Edit" : undefined}
          >
            <span className="codicon codicon-edit tab-button-icon"></span>
            {!showIconsOnly && "Edit"}
          </button>
          <button
            onClick={() => setTab("view")}
            className={`tab-button ${tab === "view" ? "active" : ""}`}
            title={showIconsOnly ? "HTML" : undefined}
          >
            <span className="codicon codicon-code tab-button-icon"></span>
            {!showIconsOnly && "HTML"}
          </button>
          <button
            onClick={() => setTab("md")}
            className={`tab-button ${tab === "md" ? "active" : ""}`}
            title={showIconsOnly ? "Markdown" : undefined}
          >
            <span className="codicon codicon-markdown tab-button-icon"></span>
            {!showIconsOnly && "Markdown"}
          </button>
        </div>

        {tab === "edit" && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DocEdit doc={doc} update={update} />
          </div>
        )}

        {tab === "view" && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', minWidth: 0 }}>
            <DocViewHTML doc={doc} />
          </div>
        )}

        {tab === "md" && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', minWidth: 0 }}>
            <DocViewMarkdown doc={doc} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Doc;
