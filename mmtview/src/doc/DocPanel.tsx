import React, { useEffect, useMemo, useRef, useState } from 'react';

import { DocData } from 'mmt-core/DocData';
import DocEdit from './DocEdit';
import { docToYaml, yamlToDoc } from 'mmt-core/docParsePack';
import DocView from './DocView';


const LAST_DOC_TAB_KEY = "mmtview:doc:lastTab";


interface DocProps {
  content: string;
  setContent: (value: string) => void;
}


const Doc: React.FC<DocProps> = ({ content, setContent }) => {
  const [doc, setDoc] = useState<DocData>(yamlToDoc(content));

  // Parse YAML to doc when content changes (but not if we just updated content from UI)
  useEffect(() => {
    const newDoc = yamlToDoc(content);
    if (newDoc === doc || newDoc === {} as DocData) return;
    setDoc(newDoc);
  }, [content]);

  // Update YAML when doc change (but not if we just updated doc from YAML)
  useEffect(() => {
    const newYaml = docToYaml(doc);
    if (newYaml === content || newYaml === "") {
      return;
    }
    setContent(newYaml);
  }, [doc]);

  const [tab, setTab] = useState<"edit" | "view">(
    () => (localStorage.getItem(LAST_DOC_TAB_KEY) as "edit" | "view") || "view"
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
    setDoc((prevDoc) => ({ ...prevDoc, ...patch }));
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
            title={showIconsOnly ? "View" : undefined}
          >
            <span className="codicon codicon-preview tab-button-icon"></span>
            {!showIconsOnly && "View"}
          </button>
        </div>

        {tab === "edit" && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DocEdit doc={doc} update={update} />
          </div>
        )}

        {tab === "view" && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', minWidth: 0 }}>
            <DocView doc={doc} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Doc;
