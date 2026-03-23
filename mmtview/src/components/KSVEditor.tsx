import React, { useMemo, useContext } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';

interface KSVEditorProps {
  label: string;
  value?: string | Record<string, string> | JSONRecord;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  options?: string[];
  disabled?: boolean;
  deactivated?: boolean;
  keysDisabled?: boolean;
  deletable?: boolean;
  expandable?: boolean;
  filePicker?: boolean;
  filePickerFilters?: Array<{ name?: string; extensions?: string[] }>;
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(obj?: string | Record<string, string> | JSONRecord, addEmpty: boolean = true): Array<[string, string]> {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  if (typeof obj === "string") {
    return addEmpty ? [["", ""]] : [];
  }

  // Convert JSONRecord or Record<string, string> to entries
  const entries = Object.entries(obj).map(([key, value]): [string, string] => [
    key,
    typeof value === 'string' ? value : String(value || '')
  ]);

  // Ensure there's always an empty entry at the end for adding new items
  if (addEmpty && (entries.length === 0 || entries[entries.length - 1][0] !== "")) {
    return [...entries, ["", ""]];
  }
  return entries;
}
// Key Select Value
const KSVEditor: React.FC<KSVEditorProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  options,
  disabled,
  deactivated = false,
  keysDisabled = false,
  deletable = true,
  expandable = true,
  filePicker = false,
  filePickerFilters
}) => {
  // Use an array of entries to preserve order and handle the object format
  const entries = useMemo(() => withTrailingEmptyKey(value, expandable), [value, expandable]);

  // Ensure options is always an array - safety check
  const safeOptions = Array.isArray(options) ? options : [];

  // File context (avoid calling hooks inside callbacks)
  const fileCtx = useContext(FileContext);
  const effectiveFilePickerFilters = filePickerFilters || [{ name: 'MMT files, CSV files', extensions: ['mmt', 'csv'] }];

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
    <div style={{ width: "100%" }}>
      {label ? (
        <div
          className={disabled ? "label label-disabled" : "label"}
        >
          {label}
        </div>
      ) : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody style={{ width: "100%" }}>
          {safeList(entries)
            .filter(([k], i) => !(deactivated && k === "" && i === entries.length - 1))
            .map(([k, v], i) => (
              <tr style={{ width: "100%" }} key={i}>
                <td style={{ width: "50%", padding: "5px", verticalAlign: "top" }}>
                  <input
                    value={k}
                    onChange={e => handleKeyChange(i, e.target.value)}
                    placeholder={keyPlaceholder}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    disabled={disabled || keysDisabled}
                  />
                </td>
                <td style={{ width: "50%", padding: "5px", verticalAlign: "top" }}>
                  {k.trim() !== "" && (
                    filePicker ? (
                      <FilePickerInput
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onRemovePressed={() => handleRemove(i)}
                        basePath={fileCtx?.mmtFilePath}
                        filters={effectiveFilePickerFilters}
                        showFilePicker={true}
                        removable={deletable && !deactivated}
                      />
                    ) : safeOptions.length > 0 ? (
                      <SelectWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onRemovePressed={() => handleRemove(i)}
                        options={safeOptions}
                        placeholder={valuePlaceholder}
                        disabled={disabled}
                        removable={deletable && !deactivated}
                      />
                    ) : (
                      <FieldWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onRemovePressed={() => handleRemove(i)}
                        placeholder={valuePlaceholder}
                        disabled={disabled}
                        removable={deletable && !deactivated}
                      />
                    )
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default KSVEditor;