import React from "react";

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  placeholder?: string;
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  placeholder,
}) => (
  <div style={{ position: "relative", width: "100%" }}>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      style={{
        width: "100%",
        verticalAlign: "top",
        paddingRight: 32,
      }}
      onChange={e => onChange(e.target.value)}
    />
    <button
      onClick={onRemovePressed}
      title="Remove field"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 28,
        height: 24,
        background: "transparent",
        color: "#c00",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "14px", // 20% smaller than 18px
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

export default FieldWithRemove;