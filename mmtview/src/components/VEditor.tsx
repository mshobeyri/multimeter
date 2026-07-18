import React from "react";
import FieldWithRemove from "./FieldWithRemove";
import FieldWithOptionsPicker from "./FieldWithOptionsPicker";
import SelectWithRemove from "./SelectWithRemove";
import { ParamConstraintOption } from "mmt-core/paramConstraints";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import { valueToString, stringToValue } from "./convertor";
import { isOmitSentinel } from "mmt-core/omitKeyword";

interface VEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyOptions: string | string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  /** Per-input options from `<<i:name>> [a, b]` description annotations */
  inputConstraints?: Record<string, ParamConstraintOption[]>;
  disabled?: boolean;
  deletable?: boolean;
  copyable?: boolean;
  /** Per-key match status vs selected example expected outputs (shown beside the field). */
  matchStatus?: ReadonlyMap<string, "match" | "mismatch" | "unset">;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  inputConstraints,
  disabled,
  deletable = true,
  copyable = false,
  matchStatus
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

  const handlePickedValue = (keyIndex: number, newVal: JSONValue) => {
    const key = keys[keyIndex];
    if (!key) return;

    const updated: JSONRecord = { ...(value || {}) };
    updated[key] = newVal;
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
          const displayValue = valueToString(currentValue);
          const hasValue = currentValue !== undefined;
          const typeLabel = currentValue === null
            ? "null"
            : isOmitSentinel(currentValue)
              ? "omit"
              : Array.isArray(currentValue)
                ? "array"
                : typeof currentValue;
          const pickerOptions = inputConstraints?.[key];
          const fieldMatch = matchStatus?.get(key);

          const fieldControl = valueOptions && valueOptions.length > 0 ? (
            <SelectWithRemove
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              options={valueOptions}
              placeholder="Value"
              disabled={disabled}
              removable={deletable}
            />
          ) : pickerOptions && pickerOptions.length > 0 ? (
            <FieldWithOptionsPicker
              value={displayValue}
              onChange={newVal => handleValueChange(index, newVal)}
              onPick={newVal => handlePickedValue(index, newVal)}
              onRemovePressed={() => handleRemove(index)}
              options={pickerOptions}
              placeholder="Value"
              disabled={disabled}
              removable={deletable && hasValue}
              copyable={copyable}
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
          );

          return (
            <div key={key} style={{ marginBottom: 8, paddingLeft: 20 }}>
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 500 }}>{key}</span>
                {hasValue && (
                  <span style={{ fontSize: "8px", color: "#888", marginLeft: "4px" }}>
                    ({typeLabel})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {fieldControl}
                </div>
                {fieldMatch === "match" && (
                  <span
                    className="codicon codicon-check"
                    title="Matches example output"
                    aria-label="Matches example output"
                    style={{
                      flexShrink: 0,
                      fontSize: "14px",
                      color: "var(--vscode-testing-iconPassed, #73c991)",
                    }}
                  />
                )}
                {fieldMatch === "mismatch" && (
                  <span
                    className="codicon codicon-close"
                    title="Does not match example output"
                    aria-label="Does not match example output"
                    style={{
                      flexShrink: 0,
                      fontSize: "14px",
                      color: "var(--vscode-testing-iconFailed, #f14c4c)",
                    }}
                  />
                )}
                {fieldMatch === "unset" && (
                  <span
                    className="codicon codicon-circle-outline"
                    title="Not asserted by this example"
                    aria-label="Not asserted by this example"
                    style={{
                      flexShrink: 0,
                      fontSize: "14px",
                      color: "var(--vscode-descriptionForeground, #888)",
                    }}
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