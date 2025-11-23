import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";

interface VEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyOptions: string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  disabled?: boolean;
  deletable?: boolean;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  disabled,
  deletable = true
}) => {
  // Helper to convert any value to string for display/editing
  const valueToString = (val: JSONValue): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
        return `"${val}"`;
      }
      if (val.trim() !== '' && !isNaN(Number(val))) {
        return `"${val}"`;
      }
      return val;
    }
    if (typeof val === 'boolean') return val.toString();
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const stringToValue = (val: string): JSONValue => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
      const num = Number(val);
      if (!isNaN(num) && val.trim() !== '') {
        return num;
      }
      // Try to parse JSON objects/arrays
      if ((val.startsWith('{') && val.endsWith('}')) ||
        (val.startsWith('[') && val.endsWith(']'))) {
        try {
          return JSON.parse(val);
        } catch {
          // Fall through to return as string
        }
      }
      if (val.startsWith('"') && val.endsWith('"')) {
        let trimmed = val.slice(1, -1);
        if (trimmed.toLowerCase() === 'true') return "true";
        if (trimmed.toLowerCase() === 'false') return "false";
        const num = Number(trimmed);
        if (!isNaN(num) && trimmed.trim() !== '') {
          return `${trimmed}`;
        }
      }
      return val; // Return as string
    }
    return val; // Fallback
  };

  const handleValueChange = (keyIndex: number, newVal: string) => {
    const key = keyOptions[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };

    if (newVal.trim() === "") {
      // Remove the key if value is empty
      delete updated[key];
    } else {
      // Convert string input to match original type
      updated[key] = stringToValue(newVal);
    }
    onChange(updated);
  };

  const handleRemove = (keyIndex: number) => {
    const key = keyOptions[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        className={disabled ? "label label-disabled" : "label"}
        style={{ marginBottom: "10px" }}
      >
        {label}
      </div>
      <table style={{ width: "100%" }}>
        <tbody>
          {safeList(keyOptions).map((key, index) => {
            const currentValue = value?.[key];
            const displayValue = valueToString(currentValue === undefined ? "" : currentValue);
            const hasValue = currentValue !== undefined;

            return (
              <tr key={key}>
                <td style={{ width: "50%" }}>
                  <span style={{ fontWeight: 500 }}>{key}</span>
                  {hasValue && (
                    <span style={{ fontSize: "8px", color: "#888", marginLeft: "4px" }}>
                      ({typeof currentValue})
                    </span>
                  )}
                </td>
                <td style={{ width: "50%" }}>
                  {valueOptions && valueOptions.length > 0 ? (
                    <SelectWithRemove
                      value={displayValue}
                      onChange={newVal => handleValueChange(index, newVal)}
                      onRemovePressed={() => handleRemove(index)}
                      options={valueOptions}
                      placeholder="Value"
                      disabled={disabled}
                      removable={deletable}
                    />
                  ) : (
                    <FieldWithRemove
                      value={displayValue}
                      onChange={newVal => handleValueChange(index, newVal)}
                      onRemovePressed={() => handleRemove(index)}
                      placeholder="Value"
                      disabled={disabled}
                      removable={deletable && hasValue}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default VEditor;