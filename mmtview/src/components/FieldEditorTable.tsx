import React, { useState } from "react";
import FieldEditorRow from "./FieldEditorRow";

export interface VariableField {
  key: string;
  type: string;
  name: string;
  info: string;
  value?: string;
}

interface FieldEditorTableProps {
  fields: VariableField[];
  setFields: (fields: VariableField[]) => void;
  typeOptions?: string[];
  typeComboOptions?: string[];
}

const defaultTypes = ["Name", "Info", "Type"];
const defaultTypeComboOptions = ["string", "integer", "boolean"];

const addFieldOptions = [
  { label: "Name", value: "Name" },
  { label: "Info", value: "Info" },
  { label: "Type", value: "Type" }
];

const FieldEditorTable: React.FC<FieldEditorTableProps> = ({
  fields,
  setFields,
  typeOptions = defaultTypes,
  typeComboOptions = defaultTypeComboOptions,
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
    <table
      className="FieldEditorTable"
      style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <colgroup>
        <col style={{ width: "40%" }} />
        <col style={{ width: "60%" }} />
      </colgroup>
      <tbody>
        {fields.map((field, idx) => (
          <tr key={field.key}>
            <FieldEditorRow
              field={field}
              typeOptions={typeOptions}
              typeComboOptions={typeComboOptions}
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
              <option value="">Select...</option>
              {addFieldOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default FieldEditorTable;