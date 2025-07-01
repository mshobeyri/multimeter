import React from "react";
import VEditor from "../components/VEditor";
import { ExampleData } from "../api/APIData";
import FieldWithRemove from "../components/FieldWithRemove";

interface ExampleEditorProps {
  data: ExampleData;
  apiInputs?: Record<string, string>;
  onChange: (data: ExampleData) => void;
  onRemove?: () => void;
}

const ExampleEditor: React.FC<ExampleEditorProps> = ({ data, apiInputs, onChange, onRemove }) => {
  // Helper to update fields
  const handleFieldsChange = (kv: Record<string, string>) => {
    const newFields = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
    onChange({ ...data, inputs: newFields });
  };

  // Convert fields array to object for VEditor
  const fieldsObj =
    Array.isArray(data.inputs)
      ? data.inputs.reduce((acc, cur) => ({ ...acc, ...cur }), {})
      : {};

  // Use apiInputs keys as keyOptions for VEditor
  const keyOptions = apiInputs ? Object.keys(apiInputs) : [];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "80%" }} />
      </colgroup>
      <tbody>
        <tr>
          <td className="label">name</td>
          <td style={{ padding: "8px" }}>
            <FieldWithRemove
              value={data.name}
              onChange={v => onChange({ ...data, name: v })}
              onRemovePressed={onRemove ?? (() => { })}
              placeholder="name"
            />
          </td>
        </tr>
        <tr>
          <td className="label">description</td>
          <td style={{ padding: "8px" }}>
            <input
              type="text"
              value={data.description || ""}
              onChange={e => onChange({ ...data, description: e.target.value })}
              placeholder="description"
              style={{ width: "100%" }}
            />
          </td>
        </tr>
        <VEditor
          label="fields"
          value={fieldsObj}
          onChange={handleFieldsChange}
          keyOptions={keyOptions}
        />
      </tbody>
    </table>
  );
};

export default ExampleEditor;