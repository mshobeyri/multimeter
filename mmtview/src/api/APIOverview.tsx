import React from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KVEditor from "../components/KVEditor";
import { APIData } from "./APIData";
import { jsonTypes } from "../CommonData"
import DescriptionEditor from "../components/DescriptionEditor";

interface APIOverviewProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => (
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
            tags={api.tags || []}
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
        value={(api.import ?? []).reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          const newImports = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ import: newImports });
        }}
        keyPlaceholder="name"
        valuePlaceholder="path"
      />
      <KVEditor
        label="input"
        value={(api.inputs ?? []).reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          const newInputs = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ inputs: newInputs });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <KVEditor
        label="output"
        value={(api.outputs ?? []).reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          const newOutputs = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ outputs: newOutputs });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
    </tbody>
  </table>
);

export default APIOverview;