import React, { useState } from "react";

export type ViewMode = "all" | "body" | "in/out";

interface ViewSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ viewMode, onViewModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const viewOptions: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: "all", icon: "codicon-list-unordered", label: "all" },
    { mode: "body", icon: "codicon-file-text", label: "body" },
    { mode: "in/out", icon: "codicon-arrow-swap", label: "in/out" }
  ];

  return (
    <div style={{
      position: "relative",
      zIndex: 1000,
      background: "transparent"
    }}>
      <button
        style={{
          zIndex: 1000,
          color: "var(--vscode-foreground, #d4d4d4)",
          background: "transparent"
        }}
        onClick={() => setIsOpen(!isOpen)}
        className="action-button"
      >
        <span className="codicon codicon-eye" style={{ fontSize: "12px" }}></span>
        <span style={{ fontSize: "12px" }}>{viewMode}</span>
        <span className="codicon codicon-chevron-down" style={{ fontSize: "12px" }}></span>
      </button>

      {isOpen && (
        <div style={{
          color: "var(--vscode-foreground, #d4d4d4)",
          position: "absolute",
          top: "100%",
          right: 0,
          zIndex: 1000,
          background: "var(--vscode-menu-background, #1e1e1e)",
          border: 0,
          padding: "4px 0",
          minWidth: "120px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
        }}>
          {viewOptions.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => {
                onViewModeChange(mode);
                setIsOpen(false);
              }}
              style={{
                color:  viewMode === mode ? "var(--vscode-menu-selectionForeground, #094771)" : "var(--vscode-menu-foreground, #d4d4d4)",
                background: viewMode === mode ? "var(--vscode-menu-selectionBackground, #094771)" : "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                width: "100%",
                border: "none",
                fontSize: "10px",
                cursor: "pointer",
                textAlign: "left",
                zIndex: 1000
              }}
            >
              <span className={`codicon ${icon}`} style={{ zIndex: 1000, fontSize: "10px" }}></span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewSelector;