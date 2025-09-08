import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/dist/safer";
import { JSONRecord } from "mmt-core/dist/CommonData";

interface VEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyOptions: string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  disabled?: boolean;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  disabled
}) => {
  // Helper to convert any value to string for display/editing
  const valueToString = (val: any): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'string') return val;
    if (typeof val === 'boolean') return val.toString();
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // Helper to convert string input back to the original type
  const convertToOriginalType = (stringValue: string, originalValue: any): any => {
    if (stringValue === "") return undefined; // Empty string means remove the key

    if (originalValue === null || originalValue === undefined) {
      // If no original value, try to infer type
      return inferType(stringValue);
    }

    const originalType = typeof originalValue;

    try {
      switch (originalType) {
        case 'boolean':
          if (stringValue.toLowerCase() === 'true') return true;
          if (stringValue.toLowerCase() === 'false') return false;
          // If not a valid boolean, return as string
          return stringValue;

        case 'number':
          const num = Number(stringValue);
          if (!isNaN(num) && stringValue.trim() !== '') {
            return num;
          }
          // If not a valid number, return as string
          return stringValue;

        case 'object':
          if (originalValue === null) return stringValue;
          try {
            return JSON.parse(stringValue);
          } catch {
            // If not valid JSON, return as string
            return stringValue;
          }

        case 'string':
        default:
          return stringValue;
      }
    } catch {
      return stringValue; // Fallback to string
    }
  };

  // Helper to infer type for new values
  const inferType = (str: string): any => {
    // Check if it's a boolean
    if (str.toLowerCase() === 'true') return true;
    if (str.toLowerCase() === 'false') return false;

    // Check if it's a number
    const num = Number(str);
    if (!isNaN(num) && str.trim() !== '') {
      return num;
    }

    // Check if it's JSON
    if ((str.startsWith('{') && str.endsWith('}')) ||
      (str.startsWith('[') && str.endsWith(']'))) {
      try {
        return JSON.parse(str);
      } catch {
        // Fall through to string
      }
    }

    // Default to string
    return str;
  };

  const handleValueChange = (keyIndex: number, newVal: string) => {
    const key = keyOptions[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };
    const originalValue = value?.[key];

    if (newVal.trim() === "") {
      // Remove the key if value is empty
      delete updated[key];
    } else {
      // Convert string input to match original type
      updated[key] = convertToOriginalType(newVal, originalValue);
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
            const displayValue = valueToString(currentValue);
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
                    />
                  ) : (
                    <FieldWithRemove
                      value={displayValue}
                      onChange={newVal => handleValueChange(index, newVal)}
                      onRemovePressed={() => handleRemove(index)}
                      placeholder="Value"
                      disabled={disabled}
                      removable={hasValue}
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