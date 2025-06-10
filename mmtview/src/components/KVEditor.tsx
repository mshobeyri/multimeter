import React from "react";
import FieldWithRemove from "./FieldWithRemove";

interface KVEditorProps {
  label: string;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

const KVEditor: React.FC<KVEditorProps> = ({
  label,
  value,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value"
}) => (
  <tr>
    <td style={{ padding: "8px", fontWeight: "bold", verticalAlign: "top" }}>{label}</td>
    <td style={{ padding: "8px" }}>
      <table style={{ width: "100%" }}>
        <tbody>
          {Object.entries(value || {}).map(([k, v], i) => (
            <tr key={i}>
              <td style={{ width: "40%" }}>
                <FieldWithRemove
                  value={k}
                  onChange={newKey => {
                    if (!newKey) return;
                    const newObj = { ...(value || {}) };
                    delete newObj[k];
                    newObj[newKey] = v;
                    onChange(newObj);
                  }}
                  onRemovePressed={() => {
                    const newObj = { ...(value || {}) };
                    delete newObj[k];
                    onChange(newObj);
                  }}
                  placeholder={keyPlaceholder}
                />
              </td>
              <td style={{ width: "60%" }}>
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
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                placeholder={keyPlaceholder}
                style={{ width: "90%" }}
                value={""}
                onChange={e => {
                  const newKey = e.target.value;
                  if (newKey) onChange({ ...(value || {}), [newKey]: "" });
                }}
              />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
);

export default KVEditor;