import React from "react";
import { safeList } from "mmt-core/safer";

interface SelectWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
}

const SelectWithRemove: React.FC<SelectWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  options,
  placeholder,
  disabled = false,
  removable = true,
}) => (
  <div className={`select-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
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

export default SelectWithRemove;
