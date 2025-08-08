import React from "react";
import { safeList } from "../safer";

interface ValidatableSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  showPlaceholder?: boolean;
  placeholder?: string;
}

const ValidatableSelect: React.FC<ValidatableSelectProps> = ({
  value,
  options,
  onChange,
  showPlaceholder,
  placeholder = "Select..."
}) => {
  const isValid = options.includes(value);

  return (
    <select
      value={showPlaceholder && !value ? "" : value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%",
        color: isValid ? undefined : "red",
        borderColor: isValid ? undefined : "red"
      }}
    >
      {showPlaceholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {!isValid && value && (
        <option value={value} disabled style={{ color: "red" }}>
          {value} (invalid)
        </option>
      )}
      {safeList(options).map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
};

export default ValidatableSelect;