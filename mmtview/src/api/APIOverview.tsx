import React from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KVEditor from "../components/KVEditor";
import { APIData } from "mmt-core/dist/APIData";
import { jsonTypes } from "mmt-core/dist/CommonData"
import DescriptionEditor from "../components/DescriptionEditor";
import { safeList } from "mmt-core/dist/safer";

interface APIOverviewProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => {
  const outputOptions = Object.keys(api.outputs || {});

  return (
    <div
      className="APIOverview"
      style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <div className="label">title</div>

      <div style={{ width: "100%", padding: "5px" }}>
        <input
          style={{ width: "100%" }}
          value={api.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="label">tags</div>
      <div style={{ width: "100%", padding: "5px" }}>
        <SearchableTagInput
          tags={safeList(api.tags)}
          onChange={tags => update({ tags })}
          suggestions={["security", "sessionless", "api", "user", "admin"]}
        />
      </div>

      <div className="label">description</div>
      <div style={{ width: "100%", padding: "5px" }}>
        <DescriptionEditor
          value={api.description || ""}
          onChange={value => update({ description: value })}
        />
      </div>

      <KVEditor
        label="import"
        value={api.import}
        onChange={kv => {
          update({ import: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="path"
      />
      <KVEditor
        label="inputs"
        value={api.inputs}
        onChange={kv => {
          update({ inputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <KVEditor
        label="outputs"
        value={api.outputs}
        onChange={kv => {
          update({ outputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <KVEditor
        label="extract"
        value={api.extract}
        onChange={kv => {
          update({ extract: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <KVEditor
        label="setenv"
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