import React from "react";
import { VariableField } from "./VariableEditor";

interface FieldEditorRowProps {
  field: VariableField;
  fieldOptions: string[];
  jsonTypes: string[];
  protobufTypes: string[];
  onChange: (updated: VariableField | null) => void;
}

const FieldEditorRow: React.FC<FieldEditorRowProps> = ({
  field,
  fieldOptions,
  jsonTypes,
  protobufTypes,
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
          {fieldOptions.map(opt => (
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
            style={{ width: "100%", verticalAlign: "top", minHeight: 32, resize: "vertical" }}
            onChange={e => onChange({ ...field, info: e.target.value })}
          />
        )}

        {field.type === "Protobuf" && (
          <select
            value={field.value || ""}
            onChange={e => onChange({ ...field, value: e.target.value })}
            style={{ width: "100%" }}
          >
            <option value="" disabled>Select type...</option>
            {protobufTypes.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
        {field.type === "alter_name" && (
          <input
            type="text"
            value={field.alter_name}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, alter_name: e.target.value })}
          />
        )}
        {field.type === "Alter_Name" && (
          <input
            type="text"
            value={field.Alter_Name}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, Alter_Name: e.target.value })}
          />
        )}
        {field.type === "ALTER_NAME" && (
          <input
            type="text"
            value={field.ALTER_NAME}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, ALTER_NAME: e.target.value })}
          />
        )}
        {field.type === "AlterName" && (
          <input
            type="text"
            value={field.AlterName}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, AlterName: e.target.value })}
          />
        )}
        {field.type === "altername" && (
          <input
            type="text"
            value={field.altername}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, altername: e.target.value })}
          />
        )}
        {field.type === "alterName" && (
          <input
            type="text"
            value={field.alterName}
            style={{ width: "100%", verticalAlign: "top" }}
            onChange={e => onChange({ ...field, alterName: e.target.value })}
          />
        )}
      </td>
    </>
  );
};

export default FieldEditorRow;