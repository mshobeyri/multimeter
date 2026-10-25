import React, { useRef } from "react";
import { safeList } from "mmt-core/util/safer";
import { fieldTrailingLayout } from "./FieldWithRemove";
import { KV_FIELD_ATTR } from "./kvFieldNav";

interface SelectWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
  onResetPressed?: () => void;
  resetEnabled?: boolean;
  typeLabel?: string;
  kvField?: string;
}

const SelectWithRemove: React.FC<SelectWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  options,
  placeholder,
  disabled = false,
  removable = true,
  onResetPressed,
  resetEnabled = false,
  typeLabel,
  kvField,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const resettable = typeof onResetPressed === "function";
  const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
    typeLabel,
    buttonCount: (removable ? 1 : 0) + (resettable ? 1 : 0),
  });
  const resetRight = 4 + (removable ? 32 : 0);

  return (
    <div
      ref={wrapRef}
      className={[
        "select-with-remove",
        disabled ? "is-disabled" : "",
        removable ? "has-remove" : "",
        resettable ? "has-reset" : "",
      ].filter(Boolean).join(" ")}
    >
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ paddingRight }}
        {...(kvField ? { [KV_FIELD_ATTR]: kvField } : {})}
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
      {typeText ? (
        <span className="field-type-affix" style={{ right: typeRight }} title="Value type">
          {typeText}
        </span>
      ) : null}
      {resettable && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && wrapRef.current?.contains(active)) {
              active.blur();
            }
            onResetPressed?.();
          }}
          title="Reset to default"
          aria-label="Reset to default"
          disabled={disabled || !resetEnabled}
          style={{ right: resetRight }}
          className="field-button is-reset"
        >
          <span className="codicon codicon-discard action-button" aria-hidden />
        </button>
      )}
      {removable && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemovePressed}
          title="Remove field"
          disabled={disabled}
          className="field-button is-remove"
        >
          <span className="codicon codicon-close action-button"></span>
        </button>
      )}
    </div>
  );
};

export default SelectWithRemove;
