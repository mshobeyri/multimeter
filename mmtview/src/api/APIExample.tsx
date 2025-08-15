import React from "react";
import VEditor from "../components/VEditor";
import { ExampleData } from "./APIData";
import FieldWithRemove from "../components/FieldWithRemove";
import DescriptionEditor from "../components/DescriptionEditor";
import { isNonEmptyObject } from "../safer";
import { JSONRecord } from "../CommonData";

interface APIExampleProps {
  data: ExampleData;
  apiInputs?: JSONRecord;
  onChange: (data: ExampleData) => void;
  onRemove?: () => void;
}

const APIExample: React.FC<APIExampleProps> = ({ data, apiInputs, onChange, onRemove }) => {
  // Helper to update fields
  const handleFieldsChange = (kv: JSONRecord) => {
    const newFields = { ...kv };
    onChange({ ...data, inputs: newFields });
    apiInputs = newFields;
  };

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
              value={data.name ?? ""}
              onChange={v => onChange({ ...data, name: v })}
              onRemovePressed={onRemove ?? (() => { })}
              placeholder="name"
            />
          </td>
        </tr>
        <tr>
          <td className="label">description</td>
          <td style={{ padding: "8px", width: "100%" }}>
            <DescriptionEditor
              value={data.description || ""}
              onChange={value => onChange({ ...data, description: value })}
            />
          </td>
        </tr>
        {isNonEmptyObject(apiInputs) ? (
          <VEditor
            label="fields"
            value={data.inputs || {}}
            onChange={handleFieldsChange}
            keyOptions={Object.keys(apiInputs)}
          />
        ) : (
          <tr>
            <td className="label">fields</td>
            <td style={{ padding: "8px" }}>
              <div style={{
                color: "#999",
                fontStyle: "italic",
                padding: "12px",
                textAlign: "center",
                border: "1px dashed #444",
                borderRadius: "4px",
                backgroundColor: "#2a2a2a"
              }}>
                You need to define inputs first
              </div>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default APIExample;