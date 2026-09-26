import React from "react";

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
  copyable?: boolean;
  /** Small red dot: value was resolved from r:/c: and will refresh on Send. */
  showRuntimeDot?: boolean;
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  placeholder,
  disabled = false,
  removable = true,
  copyable = false,
  showRuntimeDot = false,
}) => {
  const buttonCount = (removable ? 1 : 0) + (copyable ? 1 : 0);
  const paddingRight = buttonCount > 0 ? 12 + buttonCount * 24 : 36;

  return (
    <div className={`field-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}${showRuntimeDot ? " has-runtime-dot" : ""}`}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ paddingRight }}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
      {showRuntimeDot ? (
        <span className="mmt-runtime-dot" title="Refreshes on Send (r:/c:)" aria-hidden />
      ) : null}
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
        disabled={disabled}
        className="field-button"
      >
        <span className="action-button codicon codicon-close" />
      </button>}
    </div>
  );
};

export default FieldWithRemove;
