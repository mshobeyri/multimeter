import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import SearchableTagInput from "./SearchableTagInput";
import ParameterEditor from "./ParameterEditor";
import  {APIData } from "./APIData";

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
      <col style={{ width: "30%" }} />
      <col style={{ width: "70%" }} />
    </colgroup>
    <tbody>
      <tr>
        <td style={{ padding: "8px" }}>type</td>
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
        <td style={{ padding: "8px" }}>title</td>
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
        <td style={{ padding: "8px" }}>tags</td>
        <td style={{ padding: "8px" }}>
          <SearchableTagInput
            tags={api.tags || []}
            onChange={tags => update({ tags })}
            suggestions={["security", "sessionless", "api", "user", "admin"]}
          />
        </td>
      </tr>
      <tr>
        <td style={{ padding: "8px" }}>description</td>
        <td style={{ padding: "8px" }}>
          <input
            value={api.description || ""}
            onChange={e => update({ description: e.target.value })}
            placeholder="description"
            style={{ width: "100%" }}
          />
        </td>
      </tr>
      {/* Inputs Section */}
      <tr>
        <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>input</td>
      </tr>
      {(api.inputs || []).map((input, i) => (
        <ParameterEditor
          key={i}
          parameter={input}
          onChange={newParam => {
            const newInputs = [...(api.inputs || [])];
            newInputs[i] = newParam;
            update({ inputs: newInputs });
          }}
          valueOptions={[]} // or provide suggestions
        />
      ))}
      {/* Outputs Section */}
      <tr>
        <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>output</td>
      </tr>
      {(api.outputs || []).map((output, i) => (
        <ParameterEditor
          key={i}
          parameter={output}
          onChange={newParam => {
            const newOutputs = [...(api.outputs || [])];
            newOutputs[i] = newParam;
            update({ outputs: newOutputs });
          }}
          valueOptions={[]} // or provide suggestions
        />
      ))}
    </tbody>
  </table>
);

export default APIOverview;