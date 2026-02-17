import React from "react";

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
  copyable?: boolean;
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  placeholder,
  disabled = false,
  removable = true,
  copyable = false
}) => {
  const buttonCount = (removable ? 1 : 0) + (copyable ? 1 : 0);
  const paddingRight = buttonCount > 0 ? 12 + buttonCount * 24 : 36;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{
          width: "100%",
          verticalAlign: "top",
          cursor: disabled ? "not-allowed" : undefined,
          paddingRight,
        }}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
      {copyable && value && (
        <button
          onClick={() => navigator.clipboard.writeText(value).catch(() => {})}
          title="Copy value"
          style={{ position: 'absolute', right: removable ? 28 : 4, top: '50%', transform: 'translateY(-50%)' }}
          className="field-button"
        >
          <span className="action-button codicon codicon-copy" style={{ fontSize: "16px" }}></span>
        </button>
      )}
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
};

export default FieldWithRemove;