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
        cursor: disabled ? "not-allowed" : undefined,
        paddingRight: 36,
      }}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    />
    {removable && <button
      onClick={onRemovePressed}
      title="Remove field"
      disabled={disabled}
      style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
      className="field-button"
    >
      <span className="action-button codicon codicon-close" style={{ fontSize: "16px" }}></span>
    </button>}
  </div>
);

export default FieldWithRemove;