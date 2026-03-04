import React, { useEffect, useRef, useState, useCallback } from "react";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import { parseYaml, parseYamlDoc } from "mmt-core/markupConvertor";
import MockOverview from "./MockOverview";
import MockEndpoints from "./MockEndpoints";

interface MockPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_MOCK_PAGE_KEY = "mmtview:mock:lastPage";
const LAST_MOCK_TAB_KEY = "mmtview:mock:lastTab";

const MockPanel: React.FC<MockPanelProps> = ({ content, setContent }) => {
  const [mockData, setMockData] = useState<MockData | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState<'test' | 'edit'>(
    () => (localStorage.getItem(LAST_MOCK_PAGE_KEY) as 'test' | 'edit') || 'test'
  );
  const [tab, setTab] = useState<'overview' | 'endpoints'>(
    () => (localStorage.getItem(LAST_MOCK_TAB_KEY) as 'overview' | 'endpoints') || 'overview'
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(LAST_MOCK_PAGE_KEY, page); }, [page]);
  useEffect(() => { localStorage.setItem(LAST_MOCK_TAB_KEY, tab); }, [tab]);

  useEffect(() => {
    const checkWidth = () => {
      if (!tabContainerRef.current) { return; }
      setShowIconsOnly(tabContainerRef.current.clientWidth < 350);
    };
    checkWidth();
    const ro = new ResizeObserver(checkWidth);
    if (tabContainerRef.current) { ro.observe(tabContainerRef.current); }
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      const parsed = parseYaml(content);
      if (parsed && parsed.type === "server") {
        setMockData(parsed as MockData);
      } else {
        setMockData(null);
      }
    } catch {
      setMockData(null);
    }
  }, [content]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === "mockServerStatus") {
        setRunning(!!msg.running);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleStart = useCallback(() => {
    window.vscode?.postMessage({ command: "startMock" });
  }, []);

  const handleStop = useCallback(() => {
    window.vscode?.postMessage({ command: "stopMock" });
  }, []);

  const updateField = useCallback((key: string, value: any) => {
    try {
      const doc = parseYamlDoc(content);
      if (value === '' || value === undefined || value === null) {
        doc.delete(key);
      } else {
        doc.set(key, value);
      }
      setContent(doc.toString());
    } catch { /* ignore */ }
  }, [content, setContent]);

  if (!mockData) {
    return (
      <div style={{ padding: 16, color: "var(--vscode-descriptionForeground)" }}>
        Invalid or incomplete mock definition. Ensure the file has <code>type: mock</code>, <code>port</code>, and <code>endpoints</code>.
      </div>
    );
  }

  const protocol = mockData.protocol || "http";
  const baseUrl = `${protocol === "ws" ? "ws" : protocol}://localhost:${mockData.port}`;
  const endpointCount = mockData.endpoints?.length || 0;

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            {/* ── Run page ── */}
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header bar: run/stop + status + edit button */}
                <div style={{
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  backgroundColor: "transparent",
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
                    <span style={{ fontFamily: "var(--vscode-editor-font-family, monospace)" }}>{baseUrl}</span>
                    {" · "}{protocol.toUpperCase()}
                    {mockData.cors ? " · CORS" : ""}
                    {" · "}{endpointCount} endpoint{endpointCount !== 1 ? "s" : ""}
                    {running && (
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        backgroundColor: "#3fb950", display: "inline-block", marginLeft: 6,
                      }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {running ? (
                      <button onClick={handleStop} className="button-icon" style={{ opacity: 1 }}>
                        <span className="codicon codicon-debug-stop" />
                        Stop
                      </button>
                    ) : (
                      <button onClick={handleStart} className="button-icon" style={{ opacity: 1 }}>
                        <span className="codicon codicon-run" />
                        Run
                      </button>
                    )}
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Mock"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Mock</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable endpoint list (read-only view) */}
                <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
                  {/* Title / description */}
                  {(mockData.title || mockData.description) && (
                    <div style={{ marginBottom: 12 }}>
                      {mockData.title && (
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{mockData.title}</div>
                      )}
                      {mockData.description && (
                        <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>{mockData.description}</div>
                      )}
                    </div>
                  )}

                  {/* Endpoints as tree-view-boxes (read-only) */}
                  {(mockData.endpoints || []).map((ep, idx) => {
                    const endpoint = ep as MockEndpoint;
                    const method = (endpoint.method || "ANY").toUpperCase();
                    return (
                      <div key={idx} className="tree-view-box" style={{ cursor: "default" }}>
                        <span style={{ display: "inline-flex", paddingTop: 8, lineHeight: 0, alignSelf: "flex-start", width: 16, justifyContent: "center" }} aria-hidden>
                          <span className={`codicon ${methodIconFor(method)}`} style={{ fontSize: 14, opacity: 0.8, color: METHOD_COLORS[method.toLowerCase()] || "inherit" }} />
                        </span>
                        <div className="test-flow-box-items">
                          <span style={{ flex: "0 1 60px", fontWeight: 700, fontSize: 12, color: METHOD_COLORS[method.toLowerCase()] || "inherit" }}>{method}</span>
                          <span style={{ flex: "1 1 auto", fontSize: 12, fontFamily: "var(--vscode-editor-font-family, monospace)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{endpoint.path}</span>
                          {endpoint.name && (
                            <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, backgroundColor: "var(--vscode-badge-background)", color: "var(--vscode-badge-foreground)" }}>{endpoint.name}</span>
                          )}
                          {endpoint.match && <span style={{ fontSize: 10, fontStyle: "italic", color: "var(--vscode-descriptionForeground)" }}>match</span>}
                          {endpoint.reflect ? (
                            <span style={{ fontSize: 10, fontStyle: "italic", color: "var(--vscode-descriptionForeground)" }}>reflect</span>
                          ) : (
                            <span style={{ color: "var(--vscode-descriptionForeground)", fontSize: 12, minWidth: 28, textAlign: "right" }}>{endpoint.status ?? 200}</span>
                          )}
                          {endpoint.format && (
                            <span style={{ fontSize: 10, color: "var(--vscode-descriptionForeground)", minWidth: 28, textAlign: "right" }}>{endpoint.format}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {endpointCount === 0 && (
                    <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
                      No endpoints defined.
                    </div>
                  )}

                  {/* Fallback */}
                  {mockData.fallback && (
                    <div style={{ marginTop: 12 }}>
                      <div className="label">Fallback</div>
                      <div className="tree-view-box" style={{ cursor: "default" }}>
                        <span style={{ display: "inline-flex", paddingTop: 8, lineHeight: 0, alignSelf: "flex-start", width: 16, justifyContent: "center" }} aria-hidden>
                          <span className="codicon codicon-circle-slash" style={{ fontSize: 14, opacity: 0.8 }} />
                        </span>
                        <div className="test-flow-box-items">
                          <span style={{ flex: "0 1 60px", fontWeight: 700, fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>ANY</span>
                          <span style={{ flex: "1 1 auto", fontSize: 12, fontFamily: "var(--vscode-editor-font-family, monospace)" }}>*</span>
                          <span style={{ color: "var(--vscode-descriptionForeground)", fontSize: 12 }}>{mockData.fallback.status || 404}</span>
                          {mockData.fallback.format && (
                            <span style={{ fontSize: 10, color: "var(--vscode-descriptionForeground)" }}>{mockData.fallback.format}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proxy */}
                  {mockData.proxy && (
                    <div style={{ marginTop: 8 }}>
                      <div className="label">Proxy</div>
                      <div style={{
                        padding: "6px 10px", borderRadius: 4,
                        backgroundColor: "var(--vscode-editor-background)",
                        border: "1px solid var(--vscode-panel-border)",
                        fontSize: 12, fontFamily: "var(--vscode-editor-font-family, monospace)",
                      }}>
                        {mockData.proxy}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Edit page (tabs: Overview / Endpoints) ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header" ref={tabContainerRef}>
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('test')}
                    title="Back to Mock"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit Mock</div>
                </div>

                <div className="tab-bar">
                  <button
                    onClick={() => setTab('overview')}
                    className={`tab-button ${tab === 'overview' ? 'active' : ''}`}
                    title={showIconsOnly ? "Overview" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-search tab-button-icon" />
                    {!showIconsOnly && "Overview"}
                  </button>
                  <button
                    onClick={() => setTab('endpoints')}
                    className={`tab-button ${tab === 'endpoints' ? 'active' : ''}`}
                    title={showIconsOnly ? "Endpoints" : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-list-tree tab-button-icon" />
                    {!showIconsOnly && "Endpoints"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {tab === 'overview' && (
                  <MockOverview data={mockData} updateField={updateField} content={content} setContent={setContent} />
                )}
                {tab === 'endpoints' && (
                  <MockEndpoints content={content} setContent={setContent} mockData={mockData} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Helpers ─── */

const METHOD_COLORS: Record<string, string> = {
  get: "#61affe", post: "#49cc90", put: "#fca130", patch: "#e5c07b",
  delete: "#f93e3e", head: "#9012fe", options: "#0d5aa7",
};

function methodIconFor(method: string): string {
  switch (method.toLowerCase()) {
    case 'get': return 'codicon-arrow-down';
    case 'post': return 'codicon-arrow-up';
    case 'put': return 'codicon-arrow-swap';
    case 'patch': return 'codicon-edit';
    case 'delete': return 'codicon-trash';
    case 'head': return 'codicon-eye';
    case 'options': return 'codicon-settings-gear';
    default: return 'codicon-globe';
  }
}

export default MockPanel;
