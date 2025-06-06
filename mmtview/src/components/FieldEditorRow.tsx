import React from "react";
import { VariableField } from "./FieldEditorTable";

interface FieldEditorRowProps {
  field: VariableField;
  typeOptions: string[];
  typeComboOptions: string[];
  onChange: (updated: VariableField | null) => void;
}

const FieldEditorRow: React.FC<FieldEditorRowProps> = ({
  field,
  typeOptions,
  typeComboOptions,
  onChange,
}) => {
  return (
    <>
      {/* Left: Type Combo */}
      <td style={{ padding: "8px", verticalAlign: "top" }}>
        <select
          value={field.type}
          onChange={e => {
            const newType = e.target.value;
            if (newType === "remove") {
              onChange(null);
            } else {
              onChange({ ...field, type: newType });
            }
          }}
          style={{ width: "100%", verticalAlign: "top" }}
        >
          {typeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          <option value="remove" style={{ color: "red" }}>Remove</option>
        </select>
      </td>
      {/* Right: Field based on type */}
      <td style={{ padding: "8px", verticalAlign: "top" }}>
        {field.type === "Name" && (
          <input
            type="text"
            value={field.name}
            placeholder="Name"
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, name: e.target.value })}
          />
        )}
        {field.type === "Info" && (
          <textarea
            value={field.info}
            placeholder="Info"
            style={{ width: "100%", verticalAlign: "top", minHeight: 32, resize: "vertical"}}
            onChange={e => onChange({ ...field, info: e.target.value })}
          />
        )}
        {field.type === "Type" && (
          <select
            value={field.value || ""}
            onChange={e => onChange({ ...field, value: e.target.value })}
            style={{ width: "100%" }}
          >
            <option value="" disabled>Select type...</option>
            {typeComboOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
      </td>
    </>
  );
};

export default FieldEditorRow;