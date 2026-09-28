import React from "react";
import { ExampleData } from "mmt-core/APIData";
import FieldWithRemove from "../components/FieldWithRemove";
import DescriptionEditor from "../components/DescriptionEditor";

interface APIExampleProps {
  data: ExampleData;
  onChange: (data: ExampleData) => void;
  onRemove?: () => void;
}

const APIExample: React.FC<APIExampleProps> = ({ data, onChange, onRemove }) => {
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
    </div>
  );
};

export default APIExample;
