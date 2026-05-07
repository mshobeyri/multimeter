import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import { resolveEnvTokenValues } from "mmt-core/variableReplacer";
import { parseYaml, parseYamlDoc } from "mmt-core/markupConvertor";
import { loadEnvVariables } from "../workspaceStorage";
import MockOverview from "./MockOverview";
import MockEndpoints from "./MockEndpoints";
import { canonicalizeMockYaml } from "./mockYaml";

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
  const [envParams, setEnvParams] = useState<Record<string, any>>({});
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
    const cleanup = loadEnvVariables((envVars) => {
      const params: Record<string, any> = {};
      for (const v of envVars || []) {
        if (v && typeof v === 'object' && typeof v.name === 'string') {
          params[v.name] = v.value;
        }
      }
      setEnvParams(params);
    });
    return cleanup;
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
      setContent(canonicalizeMockYaml(doc.toString()));
    } catch { /* ignore */ }
  }, [content, setContent]);

  if (!mockData) {
    return (
      <div style={{ padding: 16, color: "var(--vscode-descriptionForeground)" }}>
        Invalid or incomplete server definition. Ensure the file has <code>type: server</code>, <code>port</code>, and <code>endpoints</code>.
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
              <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", flexDirection: "column" }}>
                <div className="api-edit-header">
                  <div className="tab-bar tab-bar-single" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="tab-button active" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 6, borderBottom: 'none' }}>
                      <span
                        className="codicon codicon-server"
                        aria-hidden
                        style={{ color: running ? '#3fb950' : undefined, transition: 'color 0.2s' }}
                      />
                      {mockData.title || 'Server'}
                    </div>
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
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
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
                  </div>
                  {/* Info chips */}
                  <div className="label" style={{ marginBottom: 8 }}>Configuration</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    <span className="mock-info-chip mock-info-chip--url">{baseUrl}</span>
                    <span className="mock-info-chip">{protocol.toUpperCase()}</span>
                    {mockData.cors && <span className="mock-info-chip">CORS</span>}
                    {mockData.tls && <span className="mock-info-chip">TLS</span>}
                    {mockData.delay && <span className="mock-info-chip">delay: {mockData.delay}ms</span>}
                  </div>

                  {/* Endpoints */}
                  <div className="label">Endpoints ({endpointCount})</div>
                  {(mockData.endpoints || []).filter((ep): ep is MockEndpoint => ep != null).map((endpoint, idx) => {
                    const method = (endpoint.method || "ANY").toUpperCase();
                    const color = METHOD_COLORS[method.toLowerCase()] || "var(--vscode-descriptionForeground)";
                    return (
                      <div key={idx} className="mock-ep-row">
                        <span className="mock-ep-icon" aria-hidden>
                          <span className={`codicon ${methodIconFor(method)}`} style={{ color }} />
                        </span>
                        <span className="mock-ep-method" style={{ color }}>{method}</span>
                        <span className="mock-ep-path">{endpoint.path}</span>
                        <span className="mock-ep-tags">
                          {endpoint.name && <span className="mock-tag mock-tag--name">{endpoint.name}</span>}
                          {endpoint.match && <span className="mock-tag">match</span>}
                        </span>
                        <span className="mock-ep-right">
                          {endpoint.reflect ? (
                            <span className="mock-tag">reflect</span>
                          ) : (
                            <span className="mock-ep-status">{endpoint.status ?? 200}</span>
                          )}
                          {endpoint.format && <span className="mock-ep-format">{endpoint.format}</span>}
                        </span>
                      </div>
                    );
                  })}

                  {endpointCount === 0 && (
                    <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", fontStyle: "italic", padding: "12px 0" }}>
                      No endpoints defined.
                    </div>
                  )}

                  {/* Fallback */}
                  {mockData.fallback && (
                    <div style={{ marginTop: 4 }}>
                      <div className="label">Fallback</div>
                      <div className="mock-ep-row mock-ep-row--fallback">
                        <span className="mock-ep-icon" aria-hidden>
                          <span className="codicon codicon-circle-slash" style={{ color: "var(--vscode-descriptionForeground)" }} />
                        </span>
                        <span className="mock-ep-method" style={{ color: "var(--vscode-descriptionForeground)" }}>ANY</span>
                        <span className="mock-ep-path">*</span>
                        <span className="mock-ep-tags" />
                        <span className="mock-ep-right">
                          <span className="mock-ep-status">{mockData.fallback.status || 404}</span>
                          {mockData.fallback.format && <span className="mock-ep-format">{mockData.fallback.format}</span>}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Proxy */}
                  {mockData.proxy && (
                    <div style={{ marginTop: 4 }}>
                      <div className="label">Proxy</div>
                      <div className="mock-proxy-row">{resolveEnvTokenValues(mockData.proxy, envParams)}</div>
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
