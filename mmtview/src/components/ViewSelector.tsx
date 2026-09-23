import React, { useState } from "react";

export type ViewMode = "all" | "params" | "headers" | "body" | "in/out" | "cookies";

interface ViewSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ viewMode, onViewModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const viewOptions: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: "all", icon: "codicon-list-unordered", label: "all" },
    { mode: "params", icon: "codicon-symbol-parameter", label: "params" },
    { mode: "headers", icon: "codicon-symbol-keyword", label: "headers" },
    { mode: "body", icon: "codicon-file-text", label: "body" },
    { mode: "in/out", icon: "codicon-arrow-swap", label: "in/out" },
    { mode: "cookies", icon: "codicon-symbol-color", label: "cookies" }
  ];

  return (
    <div className="view-selector">
      <button
        className="action-button view-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="codicon codicon-eye"></span>
        <span className="view-selector-label">{viewMode}</span>
        <span className="codicon codicon-chevron-down"></span>
      </button>

      {isOpen && (
        <div className="view-selector-menu">
          {viewOptions.map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => {
                onViewModeChange(mode);
                setIsOpen(false);
              }}
              className={`view-selector-item${viewMode === mode ? " is-selected" : ""}`}
            >
              <span className={`codicon ${icon}`}></span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewSelector;
