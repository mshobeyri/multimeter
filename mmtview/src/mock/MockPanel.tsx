import React, { useEffect, useCallback, useState } from "react";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import { resolveEnvTokenValues } from "mmt-core/variableReplacer";
import { parseYaml, parseYamlDoc } from "mmt-core/markupConvertor";
import { loadEnvVariables } from "../workspaceStorage";
import MockOverview from "./MockOverview";
import MockEndpoints from "./MockEndpoints";
import MockServerSettings from "./MockServerSettings";
import { canonicalizeMockYaml } from "./mockYaml";
import { methodTextColor } from "../shared/themeAccent";
import { useAccentChrome } from "../shared/useAccentChrome";
import TabBar from "../components/TabBar";
import RunStopToggle from "../components/RunStopToggle";
import PanelRunHeader, { HeaderAction } from "../components/PanelRunHeader";
import PanelEditHeader from "../components/PanelEditHeader";

interface MockPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_MOCK_PAGE_KEY = "mmtview:mock:lastPage";
const LAST_MOCK_TAB_KEY = "mmtview:mock:lastTab";

const MOCK_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "server" as const, label: "Server", icon: "server-environment" },
  { id: "endpoints" as const, label: "Endpoints", icon: "list-tree" },
];

const MockPanel: React.FC<MockPanelProps> = ({ content, setContent }) => {
  const [mockData, setMockData] = useState<MockData | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState<'test' | 'edit'>(
    () => (localStorage.getItem(LAST_MOCK_PAGE_KEY) as 'test' | 'edit') || 'test'
  );
  const [tab, setTab] = useState<'overview' | 'server' | 'endpoints'>(
    () => {
      const savedTab = localStorage.getItem(LAST_MOCK_TAB_KEY);
      return savedTab === 'server' || savedTab === 'endpoints' || savedTab === 'overview' ? savedTab : 'overview';
    }
  );
  const [envParams, setEnvParams] = useState<Record<string, any>>({});

  useEffect(() => { localStorage.setItem(LAST_MOCK_PAGE_KEY, page); }, [page]);
  useEffect(() => { localStorage.setItem(LAST_MOCK_TAB_KEY, tab); }, [tab]);

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

  const greenChrome = useAccentChrome("green");

  if (!mockData) {
    return (
      <div style={{ padding: 16, color: "var(--vscode-descriptionForeground)" }}>
        Invalid or incomplete server definition. Ensure the file has <code>type: server</code>, <code>port</code>, and <code>endpoints</code>.
      </div>
    );
  }

  const protocolRaw = typeof mockData.protocol === "string" ? mockData.protocol : "http";
  const protocol = resolveEnvTokenValues(protocolRaw, envParams) || "http";
  const urlScheme = protocol === "ws" ? "ws" : protocol === "https" ? "https" : "http";
  const displayPort = typeof mockData.port === "string"
    ? resolveEnvTokenValues(String(mockData.port), envParams)
    : mockData.port;
  const baseUrl = `${urlScheme}://localhost:${displayPort}`;
  const endpointCount = Array.isArray(mockData.endpoints) ? mockData.endpoints.length : 0;
  const connection = mockData.connection && typeof mockData.connection === "object"
    ? mockData.connection
    : undefined;
  const connectionMode = typeof connection?.mode === "string" ? connection.mode : undefined;

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
                <PanelRunHeader
                  icon="server"
                  title={mockData.title || 'Server'}
                  iconStyle={{ color: running ? greenChrome.text : undefined, transition: 'color 0.2s' }}
                  actions={
                    <HeaderAction
                      icon="edit"
                      label="Edit Mock"
                      onClick={() => setPage('edit')}
                    />
                  }
                />
                <div className="run-action-bar">
                  <RunStopToggle
                    running={running}
                    onRun={handleStart}
                    onStop={handleStop}
                    runLabel="Run mock"
                    stopLabel="Stop mock"
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  {/* Info chips */}
                  <div className="label" style={{ marginBottom: 8 }}>Configuration</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    <span className="mock-info-chip mock-info-chip--url">{baseUrl}</span>
                    <span className="mock-info-chip">{String(protocol).toUpperCase()}</span>
                    {mockData.cors && <span className="mock-info-chip">CORS</span>}
                    {connectionMode && connectionMode !== 'plain' && <span className="mock-info-chip">{connectionMode.toUpperCase()}</span>}
                    {mockData.delay && <span className="mock-info-chip">delay: {mockData.delay}ms</span>}
                  </div>

                  {/* Endpoints */}
                  <div className="label">Endpoints ({endpointCount})</div>
                  {(Array.isArray(mockData.endpoints) ? mockData.endpoints : []).filter((ep): ep is MockEndpoint => ep != null && typeof ep === "object").map((endpoint, idx) => {
                    const method = String(typeof endpoint.method === "string" ? endpoint.method : "ANY").toUpperCase();
                    const color = methodTextColor(method);
                    return (
                      <div key={idx} className="mock-ep-row">
                        <span className="mock-ep-icon" aria-hidden>
                          <span className={`codicon ${methodIconFor(method)}`} style={{ color }} />
                        </span>
                        <span className="mock-ep-method" style={{ color }}>{method}</span>
                        <span className="mock-ep-path">{typeof endpoint.path === "string" ? endpoint.path : String(endpoint.path ?? "")}</span>
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
                      <div className="mock-ep-row mock-ep-row--fallback">
                        <span className="mock-ep-icon" aria-hidden>
                          <span className="codicon codicon-circle-slash" style={{ color: "var(--vscode-descriptionForeground)" }} />
                        </span>
                        <span className="mock-ep-method mock-ep-method--fallback" style={{ color: "var(--vscode-descriptionForeground)" }}>FALLBACK</span>
                        <span className="mock-ep-path">/?</span>
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

            {/* ── Edit page (tabs: Overview / Server / Endpoints) ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit Mock"
                onBack={() => setPage('test')}
                backTitle="Back to Mock"
              >
                <TabBar tabs={MOCK_EDIT_TABS} value={tab} onChange={setTab} />
              </PanelEditHeader>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {tab === 'overview' && (
                  <MockOverview data={mockData} updateField={updateField} />
                )}
                {tab === 'server' && (
                  <MockServerSettings data={mockData} updateField={updateField} content={content} setContent={setContent} />
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
