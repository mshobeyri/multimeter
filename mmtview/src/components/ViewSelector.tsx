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
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="action-button"
      >
        <span className="codicon codicon-eye" style={{ fontSize: "12px" }}></span>
        <span style={{ fontSize: "12px" }}>{viewMode}</span>
        <span className="codicon codicon-chevron-down" style={{ fontSize: "12px" }}></span>
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          zIndex: 1000,
          background: "var(--vscode-menu-background, #252526)",
          border: "1px solid var(--vscode-menu-border, #454545)",
          borderRadius: "4px",
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
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                width: "100%",
                background: viewMode === mode ? "var(--vscode-menu-selectionBackground, #094771)" : "none",
                border: "none",
                color: "inherit",
                fontSize: "10px",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <span className={`codicon ${icon}`} style={{ fontSize: "10px" }}></span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewSelector;