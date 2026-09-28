import React from "react";

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Non-editable but visually normal (unlike disabled). */
  readOnly?: boolean;
  removable?: boolean;
  copyable?: boolean;
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  onBlur,
  onEnter,
  placeholder,
  disabled = false,
  readOnly = false,
  removable = true,
  copyable = false,
}) => {
  const buttonCount = (removable ? 1 : 0) + (copyable ? 1 : 0);
  const paddingRight = buttonCount > 0 ? 12 + buttonCount * 24 : 36;

  return (
    <div className={`field-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ paddingRight }}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        readOnly={readOnly}
      />
      {copyable && value && (
        <button
          onClick={() => navigator.clipboard.writeText(value).catch(() => {})}
          title="Copy value"
          className="field-button is-copy"
        >
          <span className="action-button codicon codicon-copy" />
        </button>
      )}
      {removable && <button
        onClick={onRemovePressed}
        title="Remove field"
        disabled={disabled || readOnly}
        className="field-button"
      >
        <span className="action-button codicon codicon-close" />
      </button>}
    </div>
  );
};

export default FieldWithRemove;
