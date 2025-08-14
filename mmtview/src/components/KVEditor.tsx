import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "../safer";
import { JSONRecord } from "../CommonData";

interface KVEditorProps {
  label: string;
  value?: Record<string, string> | JSONRecord;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  options?: string[];
  disabled?: boolean;
  deactivated?: boolean;
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(obj?: Record<string, string> | JSONRecord): Array<[string, string]> {
  if (!obj) {
    return [["", ""]];
  }
  
  // Convert JSONRecord or Record<string, string> to entries
  const entries = Object.entries(obj).map(([key, value]): [string, string] => [
    key, 
    typeof value === 'string' ? value : String(value || '')
  ]);
  
  // Ensure there's always an empty entry at the end for adding new items
  if (entries.length === 0 || entries[entries.length - 1][0] !== "") {
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
  options,
  disabled,
  deactivated = false
}) => {
  // Use an array of entries to preserve order and handle the object format
  const entries = useMemo(() => withTrailingEmptyKey(value), [value]);

  // Ensure options is always an array - safety check
  const safeOptions = Array.isArray(options) ? options : [];

  // Helper to convert entries array back to object
  const toObject = (arr: Array<[string, string]>): Record<string, string> =>
    safeList(arr).reduce<Record<string, string>>((acc, [k, v]) => {
      if (k.trim()) { // Only include non-empty keys
        acc[k] = v;
      }
      return acc;
    }, {});

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
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
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
      i === idx ? [k, newVal] : [k, v]
    );
    onChange(toObject(newEntries));
  };

  const handleRemove = (idx: number) => {
    const newEntries = safeList(entries).filter((_, i) => i !== idx);
    onChange(toObject(newEntries));
  };

  return (
    <tr>
      <td className={disabled ? "label label-disabled" : "label"}>{label}</td>
      <td style={{ padding: "5px" }}>
        <table style={{ width: "100%" }}>
          <tbody>
            {safeList(entries)
              .filter(([k], i) => !(deactivated && k === "" && i === entries.length - 1))
              .map(([k, v], i) => (
                <tr key={i}> {/* Use stable index-based key instead of key content */}
                  <td style={{ width: "50%" }}>
                    <input
                      value={k}
                      onChange={e => handleKeyChange(i, e.target.value)}
                      placeholder={keyPlaceholder}
                      style={{ width: "100%" }}
                      disabled={disabled}
                    />
                  </td>
                  <td style={{ width: "50%" }}>
                    {k.trim() !== "" && (
                      safeOptions.length > 0 ? (
                        <SelectWithRemove
                          value={v}
                          onChange={newVal => handleValueChange(i, newVal)}
                          onRemovePressed={() => handleRemove(i)}
                          options={safeOptions}
                          placeholder={valuePlaceholder}
                          disabled={disabled}
                        />
                      ) : (
                        <FieldWithRemove
                          value={v}
                          onChange={newVal => handleValueChange(i, newVal)}
                          onRemovePressed={() => handleRemove(i)}
                          placeholder={valuePlaceholder}
                          disabled={disabled}
                          removable={!deactivated}
                        />
                      )
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
};

export default KVEditor;