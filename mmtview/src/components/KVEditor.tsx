import React, { useMemo } from "react";
import FieldWithRemove from "./FieldWithRemove";

interface KVEditorProps {
  label: string;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

// Utility to ensure an empty key is always at the end
function withTrailingEmptyKey(obj?: Record<string, string>): Record<string, string> {
  if (!obj) return { "": "" };
  const keys = Object.keys(obj);
  if (keys.length === 0 || keys[keys.length - 1] !== "") {
    return { ...obj, "": "" };
  }
  return obj;
}

const KVEditor: React.FC<KVEditorProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value"
}) => {
  // Always use a model with a trailing empty key for rendering
  const model = useMemo(() => withTrailingEmptyKey(value), [value]);
  const entries = Object.entries(model);

  return (
    <tr>
      <td style={{ padding: "8px", fontWeight: "bold", verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "8px" }}>
        <table style={{ width: "100%" }}>
          <tbody>
            {entries.map(([k, v], i) => (
              <tr key={i}>
                <td style={{ width: "50%" }}>
                  <input
                    value={k}
                    onChange={e => {
                      const newKey = e.target.value;
                      const newObj = { ...(value || {}) };
                      delete newObj[k];
                      if (newKey) newObj[newKey] = v;
                      onChange(newObj);
                    }}
                    placeholder={keyPlaceholder}
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ width: "50%" }}>
                  {k !== "" && (
                    <FieldWithRemove
                      value={v}
                      onChange={newVal => {
                        onChange({ ...(value || {}), [k]: newVal });
                      }}
                      onRemovePressed={() => {
                        const newObj = { ...(value || {}) };
                        delete newObj[k];
                        onChange(newObj);
                      }}
                      placeholder={valuePlaceholder}
                    />
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