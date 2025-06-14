import React from "react";

interface SelectWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  options: string[];
  placeholder?: string;
}

const SelectWithRemove: React.FC<SelectWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  options,
  placeholder,
}) => (
  <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "calc(100% - 32px)",
        verticalAlign: "top",
        marginRight: 4,
        height: 24,
      }}
    >
      <option value="" disabled>
        {placeholder || "Select..."}
      </option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
    <button
      onClick={onRemovePressed}
      title="Remove field"
      style={{
        width: 28,
        height: 24,
        background: "transparent",
        color: "#c00",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        zIndex: 1,
      }}
    >
      <span style={{ fontSize: "14.4px", lineHeight: 1 }}>🗑️</span>
    </button>
  </div>
);

export default SelectWithRemove;