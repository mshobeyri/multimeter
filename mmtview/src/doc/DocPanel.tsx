import React, { useEffect, useMemo, useRef, useState } from 'react';

import { DocData } from 'mmt-core/DocData';
import { docToYaml, yamlToDoc } from 'mmt-core/docParsePack';
import DocOverview from './DocOverview';
import DocSource from './DocSource';
import DocViewHTML from './DocViewHTML';
import DocViewMarkdown from './DocViewMarkdown';
import TabBar from '../components/TabBar';
import PanelRunHeader, { HeaderAction } from '../components/PanelRunHeader';
import PanelEditHeader from '../components/PanelEditHeader';


const LAST_DOC_TAB_KEY = "mmtview:doc:lastTab";
const LAST_DOC_PAGE_KEY = "mmtview:doc:lastPage";
const LAST_DOC_VIEW_TAB_KEY = "mmtview:doc:lastViewTab";

const DOC_VIEW_TABS = [
  { id: "html" as const, label: "HTML", icon: "code" },
  { id: "md" as const, label: "Markdown", icon: "markdown" },
];

const DOC_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "source" as const, label: "Source", icon: "folder-opened" },
];


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

  useEffect(() => {
    localStorage.setItem(LAST_DOC_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_DOC_VIEW_TAB_KEY, viewTab);
  }, [viewTab]);

  useEffect(() => {
    localStorage.setItem(LAST_DOC_TAB_KEY, tab);
  }, [tab]);

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
                <PanelRunHeader
                  leading={
                    <TabBar
                      tabs={DOC_VIEW_TABS}
                      value={viewTab}
                      onChange={setViewTab}
                      collapseLabels={false}
                    />
                  }
                  actions={
                    <HeaderAction
                      icon="edit"
                      label="Edit Doc"
                      onClick={() => setPage('edit')}
                    />
                  }
                />
                <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', minWidth: 0 }}>
                  {viewTab === "html" && <DocViewHTML doc={doc} />}
                  {viewTab === "md" && <DocViewMarkdown doc={doc} />}
                </div>
              </div>
            </div>

            {/* ── Edit page (tabs: Overview / Source / HTML / Markdown) ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit Doc"
                onBack={() => setPage('view')}
                backTitle="Back to View"
              >
                <TabBar tabs={DOC_EDIT_TABS} value={tab} onChange={setTab} />
              </PanelEditHeader>

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
