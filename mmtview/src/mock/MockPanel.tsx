import React, { useContext, useEffect, useCallback, useState } from "react";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import { resolveEnvTokenValues } from "mmt-core/variableReplacer";
import { parseYaml } from "mmt-core/markupConvertor";
import { loadEnvVariables } from "../workspaceStorage";
import MockOverview from "./MockOverview";
import MockEndpoints from "./MockEndpoints";
import MockServerSettings from "./MockServerSettings";
import { patchMockYaml } from "./mockYaml";
import { methodTextColor } from "../shared/themeAccent";
import { useAccentChrome } from "../shared/useAccentChrome";
import TabBar from "../components/TabBar";
import RunStopToggle from "../components/RunStopToggle";
import PanelRunHeader, { HeaderAction } from "../components/PanelRunHeader";
import PanelEditHeader from "../components/PanelEditHeader";
import { usePanelPage } from "../usePanelPage";
import { FileContext } from "../fileContext";

interface MockPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const MOCK_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "server" as const, label: "Server", icon: "server-environment" },
  { id: "endpoints" as const, label: "Endpoints", icon: "list-tree" },
];

const MockPanel: React.FC<MockPanelProps> = ({ content, setContent }) => {
  const [mockData, setMockData] = useState<MockData | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = usePanelPage<'test' | 'edit'>('test');
  const [tab, setTab] = useState<'overview' | 'server' | 'endpoints'>('overview');
  const { mmtFilePath } = useContext(FileContext);
  const [envParams, setEnvParams] = useState<Record<string, any>>({});

  useEffect(() => {
    setTab('overview');
  }, [mmtFilePath]);

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
      setContent(patchMockYaml(content, (mock) => {
        const next = { ...mock } as MockData & Record<string, unknown>;
        if (value === '' || value === undefined || value === null) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      }));
    } catch { /* ignore */ }
  }, [content, setContent]);

  const greenChrome = useAccentChrome("green");

  if (!mockData) {
    return (
      <div className="panel-muted">
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
      <div className="panel-box is-fill">
        <div className="api-swipe-root">
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            {/* ── Run page ── */}
            <div className="api-swipe-page api-swipe-page--test">
              <div className="panel-page is-clip">
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
                <div className="panel-scroll">
                  {/* Info chips */}
                  <div className="label is-spaced">Configuration</div>
                  <div className="chip-row">
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
                    <div className="empty-hint">
                      No endpoints defined.
                    </div>
                  )}

                  {/* Fallback */}
                  {mockData.fallback && (
                    <div className="field-block is-tight">
                      <div className="mock-ep-row mock-ep-row--fallback">
                        <span className="mock-ep-icon" aria-hidden>
                          <span className="codicon codicon-circle-slash desc-fg" />
                        </span>
                        <span className="mock-ep-method mock-ep-method--fallback desc-fg">FALLBACK</span>
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
                    <div className="field-block is-tight">
                      <div className="label">Proxy</div>
                      <div className="mock-proxy-row">{resolveEnvTokenValues(mockData.proxy, envParams)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Edit page (tabs: Overview / Server / Endpoints) ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              {page === 'edit' && (
                <React.Fragment key={mmtFilePath}>
                  <PanelEditHeader
                    title="Edit Mock"
                    onBack={() => setPage('test')}
                    backTitle="Back to Mock"
                  >
                    <TabBar tabs={MOCK_EDIT_TABS} value={tab} onChange={setTab} />
                  </PanelEditHeader>

                  <div className="panel-scroll">
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
                </React.Fragment>
              )}
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
