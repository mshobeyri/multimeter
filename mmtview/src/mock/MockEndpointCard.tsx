import React from "react";
import { MockEndpoint } from "mmt-core/MockData";

interface MockEndpointCardProps {
  endpoint: MockEndpoint;
  index: number;
}

const METHOD_COLORS: Record<string, string> = {
  get: "#61affe",
  post: "#49cc90",
  put: "#fca130",
  patch: "#e5c07b",
  delete: "#f93e3e",
  head: "#9012fe",
  options: "#0d5aa7",
};

const MockEndpointCard: React.FC<MockEndpointCardProps> = ({ endpoint }) => {
  const method = (endpoint.method || "ANY").toUpperCase();
  const methodColor = METHOD_COLORS[(endpoint.method || "").toLowerCase()] || "var(--vscode-descriptionForeground)";
  const status = endpoint.status ?? 200;
  const format = endpoint.format || "";
  const hasMatch = !!endpoint.match;
  const isReflect = !!endpoint.reflect;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      marginBottom: 4,
      borderRadius: 4,
      backgroundColor: "var(--vscode-editor-background)",
      border: "1px solid var(--vscode-panel-border)",
      fontSize: 12,
      fontFamily: "var(--vscode-editor-font-family, monospace)",
    }}>
      <span style={{
        fontWeight: 700,
        color: methodColor,
        minWidth: 52,
        textAlign: "left",
      }}>
        {method}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {endpoint.path}
      </span>
      {endpoint.name && (
        <span style={{
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: 3,
          backgroundColor: "var(--vscode-badge-background)",
          color: "var(--vscode-badge-foreground)",
        }}>
          {endpoint.name}
        </span>
      )}
      {hasMatch && (
        <span style={{
          fontSize: 10,
          fontStyle: "italic",
          color: "var(--vscode-descriptionForeground)",
        }}>
          match
        </span>
      )}
      {isReflect ? (
        <span style={{
          fontSize: 10,
          fontStyle: "italic",
          color: "var(--vscode-descriptionForeground)",
        }}>
          reflect
        </span>
      ) : (
        <span style={{ color: "var(--vscode-descriptionForeground)", minWidth: 28, textAlign: "right" }}>
          {status}
        </span>
      )}
      {format && (
        <span style={{
          fontSize: 10,
          color: "var(--vscode-descriptionForeground)",
          minWidth: 28,
          textAlign: "right",
        }}>
          {format}
        </span>
      )}
    </div>
  );
};

export default MockEndpointCard;
