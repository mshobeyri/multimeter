import React, { useState } from "react";
import { safeList } from "mmt-core/safer";

interface EditableSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const EditableSelect: React.FC<EditableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select or type...",
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    if (inputValue !== value) {
      onChange(inputValue);
    }
  };

  return editing ? (
    <input
      type="text"
      value={inputValue}
      autoFocus
      onChange={e => setInputValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === "Enter") {
          setEditing(false);
          if (inputValue !== value) {
            onChange(inputValue);
          }
        }
        if (e.key === "Escape") {
          setEditing(false);
          setInputValue(value);
        }
      }}
      placeholder={placeholder}
      style={{ width: "100%" }}
    />
  ) : (
    <select
      value={options.includes(value) ? value : ""}
      onChange={e => onChange(e.target.value)}
      onDoubleClick={() => setEditing(true)}
      style={{ width: "100%" }}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {safeList(options).map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value="__edit__" disabled>
        (Double-click to edit)
      </option>
    </select>
  );
};

export default EditableSelect;