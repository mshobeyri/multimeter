import React from "react";
import VEditor from "../components/VEditor";
import { ExampleData } from "mmt-core/APIData";
import FieldWithRemove from "../components/FieldWithRemove";
import DescriptionEditor from "../components/DescriptionEditor";
import { isNonEmptyObject } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";

interface APIExampleProps {
  data: ExampleData;
  apiInputs?: JSONRecord;
  apiOutputs?: JSONRecord;
  onChange: (data: ExampleData) => void;
  onRemove?: () => void;
}

const APIExample: React.FC<APIExampleProps> = ({ data, apiInputs, apiOutputs, onChange, onRemove }) => {
  // Helper to update fields
  const handleFieldsChange = (kv: JSONRecord) => {
    const newFields = { ...kv };
    onChange({ ...data, inputs: newFields });
    apiInputs = newFields;
  };

  const handleOutputsChange = (kv: JSONRecord) => {
    const newFields = { ...kv };
    onChange({ ...data, outputs: newFields });
  };

  return (
    <div style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>


      <div className="label">name</div>
      <div style={{ padding: "5px" }}>
        <FieldWithRemove
          value={data.name ?? ""}
          onChange={v => onChange({ ...data, name: v })}
          onRemovePressed={onRemove ?? (() => { })}
          placeholder="name"
        />
      </div>

      <div className="label">description</div>
      <div style={{ padding: "5px", width: "100%" }}>
        <DescriptionEditor
          value={data.description || ""}
          onChange={value => onChange({ ...data, description: value })}
        />
      </div>

      {isNonEmptyObject(apiInputs) ? (
        <VEditor
          label="inputs"
          value={data.inputs || {}}
          onChange={handleFieldsChange}
          keyOptions={Object.keys(apiInputs)}
        />
      ) : (
        <>
          <div className="label">inputs</div>
          <div style={{ padding: "5px" }}>
            <div className="error-panel">
              You need to define inputs first
            </div>
          </div>
        </>
      )}

      {isNonEmptyObject(apiOutputs) ? (
        <VEditor
          label="expected"
          value={data.outputs || {}}
          onChange={handleOutputsChange}
          keyOptions={Object.keys(apiOutputs)}
        />
      ) : (
        <>
          <div className="label">expected</div>
          <div style={{ padding: "5px" }}>
            <div className="info-panel">
              Define outputs in the API to guide expected values
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default APIExample;