import React from "react";
import { safeList } from "mmt-core/safer";

interface SelectWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
}

const SelectWithRemove: React.FC<SelectWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  options,
  placeholder,
  disabled = false,
  removable = true,
}) => (
  <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: removable ? "calc(100% - 32px)" : "100%",
        verticalAlign: "top",
        marginRight: removable ? 4 : 0,
        background: disabled ? "#eee" : undefined,
        color: disabled ? "#aaa" : undefined,
        cursor: disabled ? "not-allowed" : undefined,
      }}
    >
      <option value="" disabled>
        {placeholder || "Select..."}
      </option>
      {safeList(options).map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    {removable && (
      <button
        onClick={onRemovePressed}
        title="Remove field"
        disabled={disabled}
        style={{
          width: 28,
          height: 24,
          background: "transparent",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontWeight: "bold",
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 1,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: "14.4px", lineHeight: 1 }}>
          <span className="codicon codicon-trash action-button" style={{ fontSize: "16px", }}></span>
        </span>
      </button>
    )}
  </div>
);

export default SelectWithRemove;