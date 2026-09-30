import React from "react";
import { safeList } from "mmt-core/safer";
import { fieldTrailingLayout } from "./FieldWithRemove";

interface SelectWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
  typeLabel?: string;
}

const SelectWithRemove: React.FC<SelectWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  options,
  placeholder,
  disabled = false,
  removable = true,
  typeLabel,
}) => {
  const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
    typeLabel,
    buttonCount: removable ? 1 : 0,
  });

  return (
    <div className={`select-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ paddingRight }}
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
      {removable && (
        <button
          onClick={onRemovePressed}
          title="Remove field"
          disabled={disabled}
          className="field-button"
        >
          <span className="codicon codicon-close action-button"></span>
        </button>
      )}
    </div>
  );
};

export default SelectWithRemove;
