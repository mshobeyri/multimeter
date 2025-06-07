import React, { useState } from "react";
import FieldEditorRow from "./FieldEditorRow";

const protobufTypes = [
  "double",
  "float",
  "int32",
  "int64",
  "uint32",
  "uint64",
  "sint32",
  "sint64",
  "fixed32",
  "fixed64",
  "sfixed32",
  "sfixed64",
  "bool",
  "string",
  "bytes"
];

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
  "string",
  "string[]",
  "number",
  "number[]",
  "boolean",
  "boolean[]"
];

const fieldOptions = [
  "Info",
  "Protobuf",
  "alter_name",
  "Alter_Name",
  "ALTER_NAME",
  "AlterName",
  "altername",
  "alterName",
];

interface VariableEditorProps {
  fields: VariableField[];
  setFields: (fields: VariableField[]) => void;
  fieldOptions?: string[];
  jsonTypes?: string[];
  protobufTypes?: string[];
  onRemove?: () => void;
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  fields,
  setFields,
  onRemove,
}) => {
  const [addType, setAddType] = useState<string>("");

  // Compute which optional fields are not yet present
  const usedTypes = new Set(fields.map(f => f.type));
  const availableOptionals = fieldOptions.filter(opt => !usedTypes.has(opt));

  const handleRowChange = (idx: number, updated: VariableField | null) => {
    if (updated === null) {
      setFields(fields.filter((_, i) => i !== idx));
    } else {
      setFields(fields.map((f, i) => (i === idx ? updated : f)));
    }
  };

  const handleAdd = (type: string) => {
    setFields([
      ...fields,
      { key: Date.now().toString(), name: "", type, info: "", value: "" },
    ]);
    setAddType("");
  };

  return (
    <div
      style={{
        position: "relative", // <-- make the frame relative for absolute button
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
            bottom: "100%",
            transform: "translateX(-50%) translateY(-50%)",
            width: 20,
            height: 20,
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
                // value={fields.Name || ""}
                placeholder="Name"
                style={{ width: "100%", verticalAlign: "top" }}
              // onChange={e => setAddType()}
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Type
            </td>

            <td style={{ padding: "8px" }}>
              <select
                // value={field.Type || ""}
                // onChange={e => setAddType({ ...field, value: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="" disabled>Select type...</option>
                {jsonTypes.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </td>
          </tr>
          {fields.map((field, idx) => (
            <tr key={field.key}>
              <FieldEditorRow
                field={field}
                fieldOptions={fieldOptions}
                jsonTypes={jsonTypes}
                protobufTypes={protobufTypes}
                onChange={updated => handleRowChange(idx, updated)}
              />
            </tr>
          ))}
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
        </tbody>
      </table>
    </div>
  );
};

export default VariableEditor;