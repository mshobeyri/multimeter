import React, { useState } from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KSVEditor from "../components/KSVEditor";
import KVEditor from "../components/KVEditor";
import { APIData } from "mmt-core/APIData";
import DescriptionEditor from "../components/DescriptionEditor";
import MdViewer from "../components/MdViewer";
import { safeList } from "mmt-core/safer";

interface APIOverviewProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => {
  const outputOptions = Object.keys(api.outputs || {});
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div
      className="APIOverview"
      style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <div className="label">Title</div>

      <div style={{ width: "100%", padding: "5px" }}>
        <input
          style={{ width: "100%" }}
          value={api.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="label">Tags</div>
      <div style={{ width: "100%", padding: "5px" }}>
        <SearchableTagInput
          tags={safeList(api.tags)}
          onChange={tags => update({ tags })}
          suggestions={["security", "sessionless", "api", "user", "admin"]}
        />
      </div>

      <div className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Description</span>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 400, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={showPreview}
            onChange={e => setShowPreview(e.target.checked)}
            style={{ margin: 0, cursor: "pointer" }}
          />
          Preview
        </label>
      </div>
      <div style={{ width: "100%", padding: "5px" }}>
        <DescriptionEditor
          value={api.description || ""}
          onChange={value => update({ description: value })}
        />
      </div>
      {showPreview && api.description && (
        <div style={{ width: "100%", padding: "0 5px" }}>
          <MdViewer
            description={api.description}
            inputs={api.inputs}
            outputs={api.outputs}
          />
        </div>
      )}

      <KSVEditor
        label="Import"
        value={api.import}
        onChange={kv => {
          update({ import: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="path"
        filePicker={true}
      />
      <KVEditor
        label="Inputs"
        value={api.inputs}
        onChange={kv => {
          update({ inputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
      />
      <KSVEditor
        label="Outputs"
        value={api.outputs}
        onChange={kv => {
          update({ outputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
      />
      <KSVEditor
        label="Setenv"
        value={api.setenv}
        onChange={kv => {
          update({ setenv: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="output key"
        options={outputOptions}
      />
    </div >
  );
};

export default APIOverview;