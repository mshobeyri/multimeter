import React from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KVEditor from "../components/KVEditor";
import { TestData } from "./TestData";
import { jsonTypes } from "../CommonData";
import VEditor from "../components/VEditor";
import DescriptionEditor from "../components/DescriptionEditor";

interface TestOverviewProps {
  test: TestData;
  update: (patch: Partial<TestData>) => void;
}

const TestOverview: React.FC<TestOverviewProps> = ({ test, update }) => (
  <table
    className="TestOverview"
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
            value={test.title || ""}
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
            tags={test.tags || []}
            onChange={tags => update({ tags })}
            suggestions={["security", "sessionless", "test", "user", "admin"]}
          />
        </td>
      </tr>
      <tr>
        <td className="label">description</td>
        <td style={{ padding: "8px", width: "100%" }}>
          <DescriptionEditor
            value={test.description || ""}
            onChange={value => update({ description: value })}
          />
        </td>
      </tr>
      <KVEditor
        label="import"
        value={test.import?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          const newImports = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ import: newImports });
        }}
        keyPlaceholder="name"
        valuePlaceholder="path"
      />
      <KVEditor
        label="input"
        value={test.inputs?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
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
        value={test.outputs?.reduce((acc, cur) => ({ ...acc, ...cur }), {})}
        onChange={kv => {
          const newOutputs = Object.entries(kv).map(([key, value]) => ({ [key]: value }));
          update({ outputs: newOutputs });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
        options={jsonTypes}
      />
      <tr>
        <td colSpan={2}>
          <hr style={{ border: 0, borderTop: "1px solid #444", margin: "16px 0" }} />
        </td>
      </tr>
      <VEditor
        label="metrics"
        value={
          test.metrics
            ? Object.fromEntries(
              Object.entries(test.metrics).map(([k, v]) => [k, String(v)])
            )
            : {}
        }
        onChange={metrics =>
          update({
            metrics: Object.fromEntries(
              Object.entries(metrics).map(([k, v]) => [k, v])
            ) as any, // Cast to TestMetric if needed
          })
        }
        keyOptions={["repeat", "threads", "duration", "rampup"]}
      // valuePlaceholder="value"
      />
    </tbody>
  </table>
);

export default TestOverview;