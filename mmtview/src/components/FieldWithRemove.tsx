import React from "react";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";
import TokenFieldInput from "./TokenFieldInput";

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
  /** Opt into resolved/token dual-mode when the value contains tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
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
  canContainToken = false,
  valueContext,
}) => {
  const buttonCount = (removable ? 1 : 0) + (copyable ? 1 : 0);
  const paddingRight = buttonCount > 0 ? 12 + buttonCount * 24 : 36;

  return (
    <div className={`field-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}>
      {canContainToken && !disabled && !readOnly ? (
        <TokenFieldInput
          value={value}
          canContainToken
          valueContext={valueContext}
          placeholder={placeholder}
          style={{ paddingRight }}
          onCommit={next => {
            onChange(next);
            onBlur?.();
          }}
          onDraftChange={onChange}
          onKeyDown={e => {
            if (e.key === "Enter") {
              onEnter?.();
            }
          }}
        />
      ) : (
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
      )}
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
