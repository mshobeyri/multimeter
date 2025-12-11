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
      <table style={{ width: "100%" }}>
        <tbody>
          {safeList(keys).map((key, index) => {
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