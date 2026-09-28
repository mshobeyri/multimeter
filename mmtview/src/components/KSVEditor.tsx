import React, { useMemo, useContext } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "mmt-core/safer";
import { JSONRecord, JSONValue } from "mmt-core/CommonData";
import FilePickerInput from "./FilePickerInput";
import { FileContext } from '../fileContext';
import { valueToString, stringToValue } from "./convertor";

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

function toStoredString(display: string): string {
  const typed = stringToValue(display);
  if (typeof typed === "string") {
    return typed;
  }
  return valueToString(typed as JSONValue);
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(
  obj?: string | Record<string, string> | JSONRecord,
  addEmpty: boolean = true,
): Array<[string, string]> {
  if (!obj) {
    return addEmpty ? [["", ""]] : [];
  }

  if (typeof obj === "string") {
    return addEmpty ? [["", ""]] : [];
  }

  // Display via convertor so omit / numbers / quoted token literals stay correct
  // and `__MMT_LITERAL__:` never leaks into the field UI.
  const entries = Object.entries(obj).map(([key, value]): [string, string] => [
    key,
    valueToString(value as JSONValue),
  ]);

  if (addEmpty && (entries.length === 0 || entries[entries.length - 1][0] !== "")) {
    return [...entries, ["", ""]];
  }
  return entries;
}

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
  filePickerFilters,
}) => {
  const entries = useMemo(() => withTrailingEmptyKey(value, expandable), [value, expandable]);
  const safeOptions = Array.isArray(options) ? options : [];

  const fileCtx = useContext(FileContext);
  const effectiveFilePickerFilters = filePickerFilters || [{
    name: 'MMT, data, HTTP, Bruno, and JS files',
    extensions: ['mmt', 'csv', 'json', 'yaml', 'yml', 'http', 'https', 'bru', 'bruno', 'js', 'cjs', 'mjs'],
  }];

  const toObject = (arr: Array<[string, string]>): Record<string, string> =>
    safeList(arr).reduce<Record<string, string>>((acc, [k, v]) => {
      if (k.trim()) {
        acc[k] = toStoredString(v);
      }
      return acc;
    }, {});

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
      i === idx ? [newKey, v] : [k, v]
    );

    const seen = new Set<string>();
    const filtered = newEntries.filter(([k], i) => {
      if (!k.trim()) return true;
      if (seen.has(k) && i !== idx) return false;
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
    <div className="mmt-fill">
      {label ? (
        <div
          className={disabled ? "label label-disabled" : "label"}
        >
          {label}
        </div>
      ) : null}
      <table className="field-table">
        <tbody>
          {safeList(entries)
            .filter(([k], i) => !(deactivated && k === "" && i === entries.length - 1))
            .map(([k, v], i) => (
              <tr key={i}>
                <td>
                  <input
                    value={k}
                    onChange={e => handleKeyChange(i, e.target.value)}
                    placeholder={keyPlaceholder}
                    disabled={disabled || keysDisabled}
                  />
                </td>
                <td>
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
