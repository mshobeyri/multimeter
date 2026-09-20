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
  const handleFieldsChange = (kv: JSONRecord) => {
    onChange({ ...data, inputs: { ...kv } });
  };

  const handleOutputsChange = (kv: JSONRecord) => {
    onChange({ ...data, outputs: { ...kv } });
  };

  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <div className="label">Name</div>
        <FieldWithRemove
          value={data.name ?? ""}
          onChange={v => onChange({ ...data, name: v })}
          onRemovePressed={onRemove ?? (() => { })}
          placeholder="name"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Description</div>
        <DescriptionEditor
          value={data.description || ""}
          onChange={value => onChange({ ...data, description: value })}
        />
      </div>

      {isNonEmptyObject(apiInputs) ? (
        <VEditor
          label="Inputs"
          value={data.inputs || {}}
          onChange={handleFieldsChange}
          keyOptions={Object.keys(apiInputs)}
        />
      ) : (
        <div className="panel-form-row">
          <div className="label">Inputs</div>
          <div className="error-panel">
            You need to define inputs first
          </div>
        </div>
      )}

      {isNonEmptyObject(apiOutputs) ? (
        <VEditor
          label="Outputs"
          value={data.outputs || {}}
          onChange={handleOutputsChange}
          keyOptions={Object.keys(apiOutputs)}
        />
      ) : (
        <div className="panel-form-row">
          <div className="label">Outputs</div>
          <div className="info-panel">
            Define outputs in the API to guide expected values
          </div>
        </div>
      )}
    </div>
  );
};

export default APIExample;
