import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import { valueToString, stringToValue } from "./convertor";

interface KVEditorProps {
  label: string;
  value?: JSONRecord;
  onChange: (v: JSONRecord) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  disabled?: boolean;
  deactivated?: boolean;
  keysDisabled?: boolean;
  deletable?: boolean;
  expandable?: boolean;
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(obj?: JSONRecord, addEmpty: boolean = true): Array<[string, JSONValue]> {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  const entries = Object.entries(obj).map(([key, value]): [string, JSONValue] => [
    key,
    valueToString(value)
  ]);

  // Ensure there's always an empty entry at the end for adding new items
  if (addEmpty && (entries.length === 0 || entries[entries.length - 1][0] !== "")) {
    return [...entries, ["", ""]];
  }
  return entries;
}

const KVEditor: React.FC<KVEditorProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  disabled,
  deactivated = false,
  keysDisabled = false,
  deletable = true,
  expandable = true
}) => {
  // Use an array of entries to preserve order and handle the object format
  const entries = useMemo(() => withTrailingEmptyKey(value, expandable), [value, expandable]);

  // Helper to convert entries array back to object
  const toObject = (arr: Array<[string, JSONValue]>): Record<string, JSONValue> =>
    safeList(arr).reduce<Record<string, JSONValue>>((acc, [k, v]) => {
      if (k.trim()) { // Only include non-empty keys
        acc[k] = stringToValue(v);
      }
      return acc;
    }, {});

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, JSONValue] =>
      i === idx ? [newKey, v] : [k, v]
    );

    // Remove duplicate keys except for the current one
    const seen = new Set<string>();
    const filtered = newEntries.filter(([k], i) => {
      if (!k.trim()) return true; // Keep empty keys
      if (seen.has(k) && i !== idx) return false; // Remove duplicates
      seen.add(k);
      return true;
    });

    onChange(toObject(filtered));
  };

  const handleValueChange = (idx: number, newVal: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, JSONValue] =>
      i === idx ? [k, newVal] : [k, v]
    );
    onChange(toObject(newEntries));
  };

  const handleRemove = (idx: number) => {
    const newEntries = safeList(entries).filter((_, i) => i !== idx);
    onChange(toObject(newEntries));
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        className={disabled ? "label label-disabled" : "label"}
      >
        {label}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody style={{ width: "100%" }}>
          {safeList(entries)
            .filter(([k], index) => !(deactivated && k === "" && index === entries.length - 1))
            .map(([k, v], index) => (

              <tr style={{ width: "100%" }} key={index}>
                <td style={{ width: "50%", padding: "5px", verticalAlign: "top" }}>
                  <input
                    value={k}
                    onChange={e => handleKeyChange(index, e.target.value)}
                    placeholder={keyPlaceholder}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    disabled={disabled || keysDisabled}
                  />
                </td>
                <td style={{ width: "50%", padding: "5px", verticalAlign: "top" }}>
                  {k.trim() !== "" && (
                    <FieldWithRemove
                      value={v}
                      onChange={newVal => handleValueChange(index, newVal)}
                      onRemovePressed={() => handleRemove(index)}
                      placeholder={valuePlaceholder}
                      disabled={disabled}
                      removable={deletable && !deactivated}
                    />
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default KVEditor;