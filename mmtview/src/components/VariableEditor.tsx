import React, { useState } from "react";

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
}

const jsonTypes = [
  "string", "string[]", "number", "number[]", "boolean", "boolean[]"
];

const fieldOptions = [
  "Info", "Protobuf", "alter_name", "Alter_Name", "ALTER_NAME",
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
    updateField({ [type]: "" });
    setAddType("");
  };

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
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove Variable"
          style={{
            position: "absolute",
            top: 0,
            left: "100%",
            transform: "translateX(-50%) translateY(-50%)",
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#c00",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            lineHeight: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            zIndex: 1
          }}
        >
          ×
        </button>
      )}
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
              Name
            </td>
            <td style={{ padding: "8px" }}>
              <input
                type="text"
                value={variable.name || ""}
                placeholder="Name"
                style={{ width: "100%", verticalAlign: "top" }}
                onChange={e => updateField({ name: e.target.value })}
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Type
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
                {/* Add previous variable names if needed */}
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
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      type="text"
                      value={variable[opt as keyof VariableField] as string || ""}
                      style={{
                        width: "100%",
                        verticalAlign: "top",
                        paddingRight: 32 // leave space for the button
                      }}
                      onChange={e => updateField({ [opt]: e.target.value })}
                    />
                    <button
                      onClick={() => removeOptionalField(opt as keyof VariableField)}
                      title="Remove field"
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 28,
                        height: 24,
                        background: "transparent",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        zIndex: 1
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ) : null
          )}
          {/* Add optional field selector */}
          {availableOptionals.length > 0 && (
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