import React from "react";

export interface TrafficEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration?: number;
}

interface MockTrafficLogProps {
  traffic: TrafficEntry[];
  onClear: () => void;
}

const STATUS_COLOR = (status: number): string => {
  if (status >= 200 && status < 300) { return "#3fb950"; }
  if (status >= 300 && status < 400) { return "#d29922"; }
  if (status >= 400 && status < 500) { return "#f85149"; }
  if (status >= 500) { return "#da3633"; }
  return "var(--vscode-descriptionForeground)";
};

const MockTrafficLog: React.FC<MockTrafficLogProps> = ({ traffic, onClear }) => {
  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        marginTop: 8,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--vscode-descriptionForeground)",
        }}>
          Traffic
        </span>
        {traffic.length > 0 && (
          <button
            onClick={onClear}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 3,
              border: "1px solid var(--vscode-panel-border)",
              backgroundColor: "transparent",
              color: "var(--vscode-descriptionForeground)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>
      {traffic.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
          No traffic yet. Start the server and send requests.
        </div>
      ) : (
        <div style={{
          maxHeight: 300,
          overflow: "auto",
          borderRadius: 4,
          border: "1px solid var(--vscode-panel-border)",
        }}>
          {traffic.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                borderBottom: idx < traffic.length - 1 ? "1px solid var(--vscode-panel-border)" : "none",
                backgroundColor: idx % 2 === 0 ? "transparent" : "var(--vscode-editor-background)",
              }}
            >
              <span style={{ color: "var(--vscode-descriptionForeground)", minWidth: 60 }}>
                {entry.timestamp}
              </span>
              <span style={{ fontWeight: 600, minWidth: 48 }}>
                {entry.method}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.path}
              </span>
              <span style={{ color: STATUS_COLOR(entry.status), fontWeight: 600, minWidth: 28, textAlign: "right" }}>
                {entry.status}
              </span>
              {entry.duration !== undefined && (
                <span style={{ color: "var(--vscode-descriptionForeground)", minWidth: 48, textAlign: "right" }}>
                  {entry.duration}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MockTrafficLog;
