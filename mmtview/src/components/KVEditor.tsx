import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "../safer";

interface KVEditorProps {
  label: string;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  options?: string[];
  disabled?: boolean;
  deactivated?: boolean;
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(obj?: Record<string, string>): Array<[string, string]> {
  const entries = obj ? Object.entries(obj) : [];
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
  // Use an array of entries to preserve order
  const entries = useMemo(() => withTrailingEmptyKey(value), [value]);

  // Ensure options is always an array - safety check
  const safeOptions = Array.isArray(options) ? options : [];

  // Helper to convert entries array back to object
  const toObject = (arr: Array<[string, string]>) =>
    safeList(arr).reduce<Record<string, string>>((acc, [k, v]) => {
      if (k) acc[k] = v;
      return acc;
    }, {});

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = safeList(entries).map(([k, v], i): [string, string] =>
      i === idx ? [newKey, v] : [k, v]
    );
    // Remove duplicate keys except for the current one
    const seen = new Set<string>();
    const filtered = newEntries.filter(([k], i) => {
      if (!k) return true;
      if (seen.has(k) && i !== idx) return false;
      seen.add(k);
      return true;
    });
    onChange(toObject(filtered));
  };

  const handleValueChange = (idx: number, newVal: string) => {
    const newEntries = safeList(entries).map(([k, v], i) =>
      i === idx ? [k, newVal] : [k, v]
    );
    onChange(toObject(newEntries as [string, string][]));
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
                <tr key={i}>
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
                    {k !== "" && (
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