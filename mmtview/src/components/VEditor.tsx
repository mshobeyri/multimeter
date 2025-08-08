import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";
import { safeList } from "../safer";

interface VEditorProps {
  label: string;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyOptions: string[];         // List of allowed keys
  valueOptions?: string[];      // List of allowed values (optional)
  disabled?: boolean;
}

function withTrailingEmptyKey(obj?: Record<string, string>, keyOptions?: string[]): Array<[string, string]> {
  const entries = obj ? Object.entries(obj) : [];
  // Only add trailing empty if not all keys are used
  const usedKeys = new Set(safeList(entries).map(([k]) => k));
  const availableKeys = keyOptions ? keyOptions.filter(k => !usedKeys.has(k)) : [];
  if ((entries.length === 0 || entries[entries.length - 1][0] !== "") && availableKeys.length > 0) {
    return [...entries, ["", ""]];
  }
  return entries;
}

const VEditor: React.FC<VEditorProps> = ({
  label,
  value,
  onChange,
  keyOptions,
  valueOptions,
  disabled
}) => {
  // Use an array of entries to preserve order
  const entries = useMemo(() => withTrailingEmptyKey(value, keyOptions), [value, keyOptions]);

  // Helper to convert entries array back to object
  const toObject = (arr: Array<[string, string]>) =>
    safeList(arr).reduce<Record<string, string>>((acc, [k, v]) => {
      if (k) acc[k] = v;
      return acc;
    }, {});

  const handleValueChange = (idx: number, newVal: string) => {
    const key = keyOptions[idx];
    // Build new object with all keyOptions, updating the changed one
    const updated: Record<string, string> = {};
    keyOptions.forEach((k, i) => {
      if (i === idx) {
        updated[k] = newVal;
      } else {
        // Use existing value if present, else empty string
        const entryIdx = shownEntries.findIndex(([key]) => key === k);
        updated[k] = entryIdx !== -1 ? shownEntries[entryIdx][1] : "";
      }
    });
    onChange(updated);
  };

  const handleRemove = (idx: number) => {
    const newEntries = entries.filter((_, i) => i !== idx);
    onChange(toObject(newEntries));
  };

  // Only show keys that are present in value (not trailing empty)
  const shownEntries = entries.filter(([k]) => k);

  return (
    <tr>
      <td className={disabled ? "label label-disabled" : "label"}>{label}</td>
      <td style={{ padding: "5px" }}>
        <table style={{ width: "100%" }}>
          <tbody>
            {safeList(keyOptions).map((k, i) => {
              const entryIdx = shownEntries.findIndex(([key]) => key === k);
              const v = entryIdx !== -1 ? shownEntries[entryIdx][1] : "";
              return (
                <tr key={k}>
                  <td style={{ width: "50%" }}>
                    <span style={{ fontWeight: 500 }}>{k}</span>
                  </td>
                  <td style={{ width: "50%" }}>
                    {valueOptions && valueOptions.length > 0 ? (
                      <SelectWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(entryIdx, newVal)}
                        onRemovePressed={() => handleRemove(entryIdx)}
                        options={valueOptions}
                        placeholder="Value"
                        disabled={disabled}
                      />
                    ) : (
                      <FieldWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(entryIdx, newVal)}
                        onRemovePressed={() => handleRemove(entryIdx)}
                        placeholder="Value"
                        disabled={disabled}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </td>
    </tr>
  );
};

export default VEditor;