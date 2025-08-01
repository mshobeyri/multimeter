import React from "react";

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  placeholder,
  disabled = false,
  removable = true
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
        cursor: disabled ? "not-allowed" : undefined,
      }}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    />
    {removable && <button
      onClick={onRemovePressed}
      title="Remove field"
      disabled={disabled}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 28,
        height: 24,
        background: "transparent",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        zIndex: 1,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="codicon codicon-trash" style={{ fontSize: "16px" }}></span>
    </button>}
  </div>
);

export default FieldWithRemove;