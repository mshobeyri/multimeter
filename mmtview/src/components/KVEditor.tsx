import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";
import SelectWithRemove from "./SelectWithRemove";

interface KVEditorProps {
  label: string;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  options?: string[]; // <-- Add this line
  disabled?: boolean;
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
  options, // <-- Add this line
  disabled
}) => {
  // Use an array of entries to preserve order
  const entries = useMemo(() => withTrailingEmptyKey(value), [value]);

  // Helper to convert entries array back to object
  const toObject = (arr: Array<[string, string]>) =>
    arr.reduce<Record<string, string>>((acc, [k, v]) => {
      if (k) acc[k] = v;
      return acc;
    }, {});

  const handleKeyChange = (idx: number, newKey: string) => {
    const newEntries = entries.map(([k, v], i): [string, string] =>
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
    const newEntries = entries.map(([k, v], i) =>
      i === idx ? [k, newVal] : [k, v]
    );
    onChange(toObject(newEntries as [string, string][]));
  };

  const handleRemove = (idx: number) => {
    const newEntries = entries.filter((_, i) => i !== idx);
    onChange(toObject(newEntries));
  };

  return (
    <tr>
      <td className={disabled ? "label label-disabled" : "label"}>{label}</td>
      <td style={{ padding: "5px" }}>
        <table style={{ width: "100%" }}>
          <tbody>
            {entries.map(([k, v], i) => (
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
                    options && options.length > 0 ? (
                      <SelectWithRemove
                        value={v}
                        onChange={newVal => handleValueChange(i, newVal)}
                        onRemovePressed={() => handleRemove(i)}
                        options={options}
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