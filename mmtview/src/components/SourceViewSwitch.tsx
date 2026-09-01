import React from "react";

export type SourceViewMode = "api" | "test";

const VIEW_TABS: Array<{id: SourceViewMode; label: string; icon: string}> = [
  {id: "api", label: "As API", icon: "send"},
  {id: "test", label: "As Test", icon: "beaker"},
];

interface SourceViewSwitchProps {
  value: SourceViewMode;
  onChange: (value: SourceViewMode) => void;
}

const SourceViewSwitch: React.FC<SourceViewSwitchProps> = ({value, onChange}) => (
  <div className="source-view-switch" role="tablist" aria-label="Open as API or test">
    {VIEW_TABS.map(tab => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={value === tab.id}
        className={`source-view-switch-btn${value === tab.id ? " is-active" : ""}`}
        onClick={() => onChange(tab.id)}
      >
        <span className={`codicon codicon-${tab.icon}`} aria-hidden />
        {tab.label}
      </button>
    ))}
  </div>
);

export default SourceViewSwitch;
