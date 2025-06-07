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

const jsonTypes = ["string", "number", "boolean"];
const fieldOptions = [
  "Name",
  "Type",
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
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  fields,
  setFields,
}) => {
  const [addType, setAddType] = useState<string>("");

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
                {fieldOptions.map(opt => (
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