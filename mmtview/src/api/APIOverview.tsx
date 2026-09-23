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
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="panel-form APIOverview">
      <div className="panel-form-row">
        <div className="label">Title</div>
        <input
          value={api.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Tags</div>
        <SearchableTagInput
          tags={safeList(api.tags)}
          onChange={tags => update({ tags })}
          suggestions={["security", "sessionless", "api", "user", "admin"]}
        />
      </div>

      <div className="panel-form-row">
        <div className="label label-row">
          <span>Description</span>
          <label className="label-action">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={e => setShowPreview(e.target.checked)}
            />
            Preview
          </label>
        </div>
        <DescriptionEditor
          value={api.description || ""}
          onChange={value => update({ description: value })}
        />
        {showPreview && api.description ? (
          <MdViewer
            description={api.description}
            inputs={api.inputs}
            outputs={api.outputs}
          />
        ) : null}
      </div>

      <KSVEditor
        label="Import"
        value={api.import}
        onChange={kv => {
          update({ import: kv });
        }}
        keyPlaceholder="alias"
        valuePlaceholder="path"
        filePicker={true}
        filePickerFilters={[
          { name: "Data files", extensions: ["json", "yaml", "yml", "csv"] },
        ]}
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
        valuePlaceholder="body.path or regex"
      />
    </div>
  );
};

export default APIOverview;
