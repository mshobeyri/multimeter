import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";

interface LEditorProps {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Helper: always show a trailing empty field for editing, but don't store it in value
function withTrailingEmpty(arr: string[]): string[] {
  return arr.length === 0 || arr[arr.length - 1] !== "" ? [...arr, ""] : arr;
}

const LEditor: React.FC<LEditorProps> = ({
  value,
  onChange,
  placeholder,
  disabled
}) => {
  // Only add trailing empty for rendering, not for storage
  const entries = useMemo(() => withTrailingEmpty(value), [value]);

  const handleChange = (idx: number, newVal: string) => {
    // If editing the trailing empty, append to value
    if (idx === value.length) {
      if (newVal !== "") {
        onChange([...value, newVal]);
      }
    } else {
      const updated = value.map((v, i) => (i === idx ? newVal : v));
      // Remove any empty values except for trailing
      onChange(updated.filter((v, i, arr) => v !== "" || i === arr.length - 1));
    }
  };

  const handleRemove = (idx: number) => {
    const updated = value.filter((_, i) => i !== idx);
    onChange(updated);
  };

  // Only show all except the last if it's empty
  const shownEntries =
    entries.length > 1 && entries[entries.length - 1] === ""
      ? entries.slice(0, -1)
      : entries;

  return (
    <table style={{ width: "100%" }}>
      <tbody>
        {shownEntries.map((val, idx) => (
          <tr key={idx}>
            <td style={{ width: "90%" }}>
              <FieldWithRemove
                value={val}
                onChange={v => handleChange(idx, v)}
                onRemovePressed={() => handleRemove(idx)}
                placeholder={placeholder || "Value"}
                disabled={disabled}
              />
            </td>
          </tr>
        ))}
        {/* Trailing empty field for adding new items */}
        <tr>
          <td style={{ width: "90%" }}>
            <input
              value=""
              onChange={e => handleChange(value.length, e.target.value)}
              placeholder={placeholder || "Value"}
              disabled={disabled}
              style={{
                width: "100%"
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default LEditor;