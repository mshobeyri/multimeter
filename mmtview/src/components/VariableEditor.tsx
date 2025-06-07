import { on } from "events";
import React, { useState } from "react";
import FieldWithRemove from "./FieldWithRemove";
import ObjectFieldsEditor from "./ObjectFieldsEditor";

const protobufTypes = [
  "double", "float", "int32", "int64", "uint32", "uint64", "sint32", "sint64",
  "fixed32", "fixed64", "sfixed32", "sfixed64", "bool", "string", "bytes"
];

export type VariablesList = VariableField[];

export interface VariableField {
  key: string;
  type: string;
  name?: string;
  info?: string;
  value?: string;
  alter_name?: string;
  Alter_Name?: string;
  ALTER_NAME?: string;
  AlterName?: string;
  altername?: string;
  alterName?: string;
  protobuf?: string;
  fields?: Record<string, string>;
}

const jsonTypes = [
  "object", "object[]", "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

const fieldOptions = [
  "info", "protobuf", "alter_name", "Alter_Name", "ALTER_NAME",
  "AlterName", "altername", "alterName"
];

interface VariableEditorProps {
  idx: number;
  variables: VariablesList;
  setVariables: (vars: VariablesList) => void;
  onRemove?: () => void;
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  idx,
  variables,
  setVariables,
  onRemove,
}) => {
  const variable = variables[idx];
  const [addType, setAddType] = useState<string>("");

  // List of optional fields not yet present in this variable
  const usedFields = new Set(
    fieldOptions.filter(opt => variable[opt as keyof VariableField] !== undefined)
  );
  const availableOptionals = fieldOptions.filter(opt => !usedFields.has(opt));

  // Update a field in the variable
  const updateField = (field: Partial<VariableField>) => {
    setVariables(
      variables.map((v, i) =>
        i === idx ? { ...v, ...field } : v
      )
    );
  };

  // Remove an optional field from the variable
  const removeOptionalField = (fieldName: keyof VariableField) => {
    setVariables(
      variables.map((v, i) =>
        i === idx ? { ...v, [fieldName]: undefined } : v
      )
    );
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

  // Get keys of previous variables (exclude current and empty keys)
  const previousVariableKeys = variables
    .slice(0, idx)
    .map(v => v.key)
    .filter(k => !!k && k !== variable.key);

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
              <select
                value={variable.type || ""}
                onChange={e => updateField({ type: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="" disabled>Select type...</option>
                {jsonTypes.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                {previousVariableKeys.length > 0 && <option disabled>────────────</option>}
                {previousVariableKeys.map(opt => (
                  <React.Fragment key={opt}>
                    <option value={opt}>{opt}</option>
                    <option value={`${opt}[]`}>{opt}[]</option>
                  </React.Fragment>
                ))}
              </select>
            </td>
          </tr>
          {/* Render optional fields */}
          {fieldOptions.map(opt =>
            variable[opt as keyof VariableField] !== undefined ? (
              <tr key={opt}>
                <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opt}
                </td>
                <td style={{ padding: "8px", position: "relative" }}>
                  <FieldWithRemove
                    value={variable[opt as keyof VariableField] as string || ""}
                    onChange={v => updateField({ [opt]: v })}
                    onRemovePressed={() => removeOptionalField(opt as keyof VariableField)}
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
                    ...variables
                      .map(v => v.key)
                      .filter(k => !!k)
                      .flatMap(k => [k, `${k}[]`])
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