import React, { useState } from "react";
import FieldWithRemove from "./FieldWithRemove";
import ObjectFieldsEditor from "./ObjectFieldsEditor";
import ValidatableSelect from "./ValidatableSelect";
import { jsonTypes } from "./APIData";
import { Variable, Variables } from "./VariablesData";

const fieldOptions = [
  "info", "protobuf", "alter_name", "Alter_Name", "ALTER_NAME",
  "AlterName", "altername", "alterName"
];

interface VariableEditorProps {
  variable: Variable;
  onChange: (v: Variable) => void;
  onRemove?: () => void;
  variables?: Variables; // Now expects an array
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  variable,
  onChange,
  onRemove,
  variables = [],
}) => {
  const [addType, setAddType] = useState<string>("");

  // List of optional fields not yet present in this variable
  const usedFields = new Set(
    fieldOptions.filter(opt => variable[opt as keyof Variable] !== undefined)
  );
  const availableOptionals = fieldOptions.filter(opt => !usedFields.has(opt));

  // Update a field in the variable
  const updateField = (field: Partial<Variable>) => {
    onChange({ ...variable, ...field });
  };

  // Remove an optional field from the variable
  const removeOptionalField = (fieldName: keyof Variable) => {
    const updated = { ...variable };
    delete updated[fieldName];
    onChange(updated);
  };

  // Add an optional field
  const handleAdd = (type: string) => {
    if (type === "field") {
      // Add a new empty field to the fields object (ObjectFieldsEditor)
      const currentFields = variable.fields || {};
      // Find a unique field name
      let newFieldName = "field";
      let counter = 1;
      while (currentFields[`${newFieldName}${counter}`]) counter++;
      newFieldName = `${newFieldName}${counter}`;
      updateField({ fields: { ...currentFields, [newFieldName]: "" } });
    } else {
      updateField({ [type]: "" });
    }
    setAddType("");
  };

  // Get names of previous variables (exclude current and empty names)
  const previousVariableNames = variables
    ? variables
        .filter(v => v !== variable && v.name && v.name !== variable.name)
        .map(v => v.name)
    : [];

  return (
    <div
      style={{
        position: "relative",
        background: "var(--vscode-editorWidget-background, #232323)",
        border: "1px solid var(--vscode-editorWidget-border, #333)",
        borderRadius: "6px",
        padding: "16px",
        minWidth: 200,
        marginBottom: "16px"
      }}
    >
      <table
        className="VariableEditor"
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "60%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              name
            </td>
            <td style={{ padding: "8px", position: "relative" }}>
              <FieldWithRemove
                value={variable.name || ""}
                onChange={v => updateField({ name: v })}
                onRemovePressed={onRemove ?? (() => { })}
                placeholder="name"
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              type
            </td>
            <td style={{ padding: "8px" }}>
              <ValidatableSelect
                value={variable.type || ""}
                options={[
                  ...jsonTypes,
                  ...previousVariableNames.flatMap(opt => [opt, `${opt}[]`])
                ]}
                onChange={val => updateField({ type: val })}
                showPlaceholder={true}
                placeholder="Select type..."
              />
            </td>
          </tr>
          {/* Render optional fields */}
          {fieldOptions.map(opt =>
            variable[opt as keyof Variable] !== undefined ? (
              <tr key={opt}>
                <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt}
                </td>
                <td style={{ padding: "8px", position: "relative" }}>
                  <FieldWithRemove
                    value={variable[opt as keyof Variable] as string || ""}
                    onChange={v => updateField({ [opt]: v })}
                    onRemovePressed={() => removeOptionalField(opt as keyof Variable)}
                    placeholder={opt}
                  />
                </td>
              </tr>
            ) : null
          )}
          {(variable.type === "object" || variable.type === "object[]") && (
            <tr>
              <td colSpan={2} style={{ padding: "8px" }}>
                <ObjectFieldsEditor
                  fields={variable.fields || {}}
                  setFields={fields => updateField({ fields: fields })}
                  typeOptions={[
                    ...jsonTypes,
                    ...previousVariableNames.flatMap(k => [k, `${k}[]`])
                  ]}
                />
              </td>
            </tr>
          )}
          {(availableOptionals.length > 0 || (variable.type === "object" || variable.type === "object[]")) && (
            <tr>
              <td colSpan={2} style={{ padding: "8px", paddingRight: "28px" }}>
                <select
                  value={addType}
                  onChange={e => {
                    if (e.target.value) handleAdd(e.target.value);
                  }}
                  style={{ width: "40%", verticalAlign: "top" }}
                >
                  <option value="">Optionals...</option>
                  {(variable.type === "object" || variable.type === "object[]") && (
                    <option value="field">field</option>
                  )}
                  {availableOptionals.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default VariableEditor;