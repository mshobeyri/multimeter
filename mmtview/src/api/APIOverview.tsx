import React from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KVEditor from "../components/KVEditor";
import { APIData } from "./APIData";
import { jsonTypes } from "../CommonData"
import DescriptionEditor from "../components/DescriptionEditor";
import { safeList } from "../safer";

interface APIOverviewProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => {
  const outputOptions = Object.keys(api.outputs || {});

  return (
    <table
      className="APIOverview"
      style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
    >
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "80%" }} />
      </colgroup>
      <tbody>
        <tr>
          <td className="label">title</td>
          <td style={{ padding: "8px" }}>
            <input
              value={api.title || ""}
              onChange={e => update({ title: e.target.value })}
              placeholder="title"
              style={{ width: "100%" }}
            />
          </td>
        </tr>
        <tr>
          <td className="label">tags</td>
          <td style={{ padding: "8px" }}>
            <SearchableTagInput
              tags={safeList(api.tags)}
              onChange={tags => update({ tags })}
              suggestions={["security", "sessionless", "api", "user", "admin"]}
            />
          </td>
        </tr>
        <tr>
          <td className="label">description</td>
          <td style={{ padding: "8px", width: "100%" }}>
            <DescriptionEditor
              value={api.description || ""}
              onChange={value => update({ description: value })}
            />
          </td>
        </tr>
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
          label="setenv"
          value={api.setenv}
          onChange={kv => {
            update({ setenv: kv });
          }}
          keyPlaceholder="name"
          valuePlaceholder="output key"
          options={outputOptions}
        />
      </tbody>
    </table>
  );
};

export default APIOverview;