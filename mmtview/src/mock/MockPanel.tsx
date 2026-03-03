import React, { useEffect, useState, useCallback } from "react";
import YAML from "yaml";
import { MockData, MockEndpoint } from "mmt-core/MockData";
import MockEndpointCard from "./MockEndpointCard";
import MockEdit from "./MockEdit";

interface MockPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const MockPanel: React.FC<MockPanelProps> = ({ content, setContent }) => {
  const [mockData, setMockData] = useState<MockData | null>(null);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState<'test' | 'edit'>('test');

  useEffect(() => {
    try {
      const parsed = YAML.parse(content);
      if (parsed && parsed.type === "mock") {
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
            {/* ── Run / view page ── */}
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header / Server controls */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--vscode-panel-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
                }}>
                  <button
                    onClick={running ? handleStop : handleStart}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      color: "var(--vscode-button-foreground)",
                      backgroundColor: running
                        ? "var(--vscode-statusBarItem-errorBackground, #c72e2e)"
                        : "var(--vscode-button-background)",
                    }}
                  >
                    {running ? "⏹ Stop" : "▶ Run"}
                  </button>
                  <span style={{
                    fontSize: 12,
                    color: "var(--vscode-descriptionForeground)",
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                  }}>
                    {baseUrl}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
                    {protocol.toUpperCase()}
                    {mockData.cors ? " · CORS" : ""}
                    {" · "}
                    {endpointCount} endpoint{endpointCount !== 1 ? "s" : ""}
                  </span>
                  {running && (
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#3fb950",
                      display: "inline-block",
                      marginLeft: 4,
                    }} />
                  )}
                  <span style={{ flex: 1 }} />
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

                {/* Title / description */}
                {(mockData.title || mockData.description) && (
                  <div style={{ padding: "8px 16px", flexShrink: 0 }}>
                    {mockData.title && (
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {mockData.title}
                      </div>
                    )}
                    {mockData.description && (
                      <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)" }}>
                        {mockData.description}
                      </div>
                    )}
                  </div>
                )}

                {/* Scrollable content */}
                <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px" }}>
                  {/* Endpoints */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: "var(--vscode-descriptionForeground)",
                      marginBottom: 8,
                      marginTop: 8,
                    }}>
                      Endpoints
                    </div>
                    {(mockData.endpoints || []).map((ep, idx) => (
                      <MockEndpointCard key={idx} endpoint={ep as MockEndpoint} index={idx} />
                    ))}
                    {endpointCount === 0 && (
                      <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
                        No endpoints defined.
                      </div>
                    )}
                  </div>

                  {/* Fallback */}
                  {mockData.fallback && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--vscode-descriptionForeground)",
                        marginBottom: 4,
                      }}>
                        Fallback
                      </div>
                      <div style={{
                        padding: "6px 10px",
                        borderRadius: 4,
                        backgroundColor: "var(--vscode-editor-background)",
                        border: "1px solid var(--vscode-panel-border)",
                        fontSize: 12,
                        fontFamily: "var(--vscode-editor-font-family, monospace)",
                      }}>
                        {mockData.fallback.status || 404}
                        {mockData.fallback.format ? ` · ${mockData.fallback.format}` : ""}
                      </div>
                    </div>
                  )}

                  {/* Proxy */}
                  {mockData.proxy && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--vscode-descriptionForeground)",
                        marginBottom: 4,
                      }}>
                        Proxy
                      </div>
                      <div style={{
                        padding: "6px 10px",
                        borderRadius: 4,
                        backgroundColor: "var(--vscode-editor-background)",
                        border: "1px solid var(--vscode-panel-border)",
                        fontSize: 12,
                        fontFamily: "var(--vscode-editor-font-family, monospace)",
                      }}>
                        {mockData.proxy}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Edit page ── */}
            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
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
              </div>
              <MockEdit content={content} setContent={setContent} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockPanel;
