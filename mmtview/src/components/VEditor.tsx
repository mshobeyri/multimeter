import React from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";
import { valueToString, stringToValue } from "./convertor";

interface VEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyOptions: string | string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  disabled?: boolean;
  deletable?: boolean;
  copyable?: boolean;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  disabled,
  deletable = true,
  copyable = false
}) => {
  const keys = typeof keyOptions === "string" ? [keyOptions]: keyOptions;

  const handleValueChange = (keyIndex: number, newVal: string) => {
    const key = keys[keyIndex];
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
    const key = keys[keyIndex];
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
      <div>
        {safeList(keys).map((key, index) => {
          const currentValue = value?.[key];
          const displayValue = valueToString(currentValue === undefined ? "" : currentValue);
          const hasValue = currentValue !== undefined;

          return (
            <div key={key} style={{ marginBottom: 8, paddingLeft: 20 }}>
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 500 }}>{key}</span>
                {hasValue && (
                  <span style={{ fontSize: "8px", color: "#888", marginLeft: "4px" }}>
                    ({Array.isArray(currentValue) ? "array" : typeof currentValue})
                  </span>
                )}
              </div>
              <div>
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
                    copyable={copyable}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VEditor;