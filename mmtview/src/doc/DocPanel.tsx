import React, { useEffect, useMemo, useRef, useState } from 'react';

import { DocData } from 'mmt-core/DocData';
import { docToYaml, yamlToDoc } from 'mmt-core/docParsePack';
import DocOverview from './DocOverview';
import DocSource from './DocSource';
import DocViewHTML from './DocViewHTML';
import DocViewMarkdown from './DocViewMarkdown';


const LAST_DOC_TAB_KEY = "mmtview:doc:lastTab";
const LAST_DOC_PAGE_KEY = "mmtview:doc:lastPage";
const LAST_DOC_VIEW_TAB_KEY = "mmtview:doc:lastViewTab";


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

  const [page, setPage] = useState<"view" | "edit">(
    () => (localStorage.getItem(LAST_DOC_PAGE_KEY) as "view" | "edit") || "view"
  );
  const [viewTab, setViewTab] = useState<"html" | "md">(
    () => {
      const saved = localStorage.getItem(LAST_DOC_VIEW_TAB_KEY);
      return (saved === "html" || saved === "md") ? saved : "html";
    }
  );
  const [tab, setTab] = useState<"overview" | "source">(
    () => {
      const saved = localStorage.getItem(LAST_DOC_TAB_KEY);
      return (saved === "overview" || saved === "source") ? saved : "overview";
    }
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LAST_DOC_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_DOC_VIEW_TAB_KEY, viewTab);
  }, [viewTab]);

  useEffect(() => {
    localStorage.setItem(LAST_DOC_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) { return; }

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      const fullTextWidth = 3 * 100;

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
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'view' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            {/* ── View page (HTML / Markdown preview + Edit button) ── */}
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div className="api-edit-header">
                  <div className="tab-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex' }}>
                      <button
                        onClick={() => setViewTab("html")}
                        className={`tab-button ${viewTab === "html" ? "active" : ""}`}
                        type="button"
                      >
                        <span className="codicon codicon-code tab-button-icon"></span>
                        HTML
                      </button>
                      <button
                        onClick={() => setViewTab("md")}
                        className={`tab-button ${viewTab === "md" ? "active" : ""}`}
                        type="button"
                      >
                        <span className="codicon codicon-markdown tab-button-icon"></span>
                        Markdown
                      </button>
                    </div>
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Doc"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Doc</span>
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', minWidth: 0 }}>
                  {viewTab === "html" && <DocViewHTML doc={doc} />}
                  {viewTab === "md" && <DocViewMarkdown doc={doc} />}
                </div>
              </div>
            </div>

            {/* ── Edit page (tabs: Overview / Source / HTML / Markdown) ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('view')}
                    title="Back to View"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit Doc</div>
                </div>
                <div ref={tabContainerRef} className="tab-bar">
                  <button
                    onClick={() => setTab("overview")}
                    className={`tab-button ${tab === "overview" ? "active" : ""}`}
                    title={showIconsOnly ? "Overview" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-search tab-button-icon"></span>
                    {!showIconsOnly && "Overview"}
                  </button>
                  <button
                    onClick={() => setTab("source")}
                    className={`tab-button ${tab === "source" ? "active" : ""}`}
                    title={showIconsOnly ? "Source" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-folder-opened tab-button-icon"></span>
                    {!showIconsOnly && "Source"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {tab === "overview" && (
                  <DocOverview doc={doc} update={update} />
                )}

                {tab === "source" && (
                  <DocSource doc={doc} update={update} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Doc;
