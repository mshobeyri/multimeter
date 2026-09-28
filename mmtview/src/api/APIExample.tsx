import React from "react";
import { ExampleData, exampleExpect } from "mmt-core/APIData";
import { JSONRecord } from "mmt-core/CommonData";
import { isNonEmptyObject } from "mmt-core/safer";
import FieldWithRemove from "../components/FieldWithRemove";
import DescriptionEditor from "../components/DescriptionEditor";
import VEditor from "../components/VEditor";
import ApiTestsEditor from "./ApiTestsEditor";

interface APIExampleProps {
  data: ExampleData;
  apiInputs?: JSONRecord;
  apiOutputs?: JSONRecord;
  onChange: (data: ExampleData) => void;
  onRemove?: () => void;
}

const APIExample: React.FC<APIExampleProps> = ({
  data,
  apiInputs,
  apiOutputs,
  onChange,
  onRemove,
}) => {
  const setId = (v: string) => {
    const next: ExampleData = { ...data, id: v };
    // Migrating off deprecated `name`: keep it as title if title was empty.
    if (!next.title?.trim() && data.name?.trim()) {
      next.title = data.name.trim();
    }
    if (next.name !== undefined) {
      delete next.name;
    }
    onChange(next);
  };

  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <div className="label">Id</div>
        <FieldWithRemove
          value={data.id ?? data.name ?? ""}
          onChange={setId}
          onRemovePressed={onRemove ?? (() => { })}
          placeholder="id"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Title</div>
        <input
          type="text"
          value={data.title ?? data.name ?? ""}
          onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder="title"
          className="mmt-fill"
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
          onChange={(kv: JSONRecord) => {
            const next = { ...data };
            if (Object.keys(kv).length > 0) {
              next.inputs = { ...kv };
            } else {
              delete next.inputs;
            }
            onChange(next);
          }}
          keyOptions={Object.keys(apiInputs || {})}
        />
      ) : (
        <div className="panel-form-row">
          <div className="label">Inputs</div>
          <div className="error-panel">You need to define inputs first</div>
        </div>
      )}

      <ApiTestsEditor
        test={{ expect: exampleExpect(data), require: data.require }}
        fieldSuggestions={typeof apiOutputs === "object" ? Object.keys(apiOutputs || {}) : []}
        onChange={(next) => {
          const updated: ExampleData = { ...data };
          if (updated.outputs !== undefined) {
            delete updated.outputs;
          }
          if (next?.expect) {
            updated.expect = next.expect;
          } else {
            delete updated.expect;
          }
          if (next?.require) {
            updated.require = next.require;
          } else {
            delete updated.require;
          }
          onChange(updated);
        }}
      />
    </div>
  );
};

export default APIExample;
