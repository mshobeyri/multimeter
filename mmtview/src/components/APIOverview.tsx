import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import SearchableTagInput from "./SearchableTagInput";
import KVEditor from "./KVEditor";
import { APIData, jsonTypes } from "./APIData";

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
        <td className="label">type</td>
        <td style={{ padding: "8px" }}>
          <ValidatableSelect
            value={api.type || ""}
            options={["api", "interface"]}
            onChange={val => update({ type: val })}
            showPlaceholder={true}
            placeholder="Select type..."
          />
        </td>
      </tr>
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
        <td style={{ padding: "8px" }}>
          <input
            value={api.description || ""}
            onChange={e => update({ description: e.target.value })}
            placeholder="description"
            style={{ width: "100%" }}
          />
        </td>
      </tr>
      <KVEditor
        label="import"
        value={api.import?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          // Convert kv object to Parameter[] (each entry: { [key]: value })
          const newImports = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ import: newImports });
        }}
        keyPlaceholder="name"
        valuePlaceholder="path"
      />
      <KVEditor
        label="input"
        value={api.inputs?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          // Convert kv object to Parameter[] (each entry: { [key]: value })
          const newInputs = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ inputs: newInputs });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <KVEditor
        label="output"
        value={api.outputs?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          // Convert kv object to Parameter[] (each entry: { [key]: value })
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