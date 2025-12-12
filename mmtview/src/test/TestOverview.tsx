import React from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KSVEditor from "../components/KSVEditor";
import { TestData } from "mmt-core/TestData";
import { jsonTypes } from "mmt-core/CommonData";
import DescriptionEditor from "../components/DescriptionEditor";

interface TestOverviewProps {
  test: TestData;
  update: (patch: Partial<TestData>) => void;
}

const TestOverview: React.FC<TestOverviewProps> = ({ test, update }) => (
  <div style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
    <div className="label">Title</div>
    <div style={{ padding: "5px" }}>
      <input
        value={test.title || ""}
        onChange={e => update({ title: e.target.value })}
        placeholder="title"
        style={{ width: "100%" }}
      />
    </div>
    <div className="label">Tags</div>
    <div style={{ padding: "5px" }}>
      <SearchableTagInput
        tags={test.tags || []}
        onChange={tags => update({ tags })}
        suggestions={["security", "sessionless", "test", "user", "admin"]}
      />
    </div>
    <div className="label">Description</div>
    <div style={{ padding: "5px", width: "100%" }}>
      <DescriptionEditor
        value={test.description || ""}
        onChange={value => update({ description: value })}
      />
    </div>

    <KSVEditor
      label="Import"
      value={test.import}
      onChange={kv => {
        update({ import: kv });
      }}
      keyPlaceholder="name"
      valuePlaceholder="path"
    />
    <KSVEditor
      label="Inputs"
      value={test.inputs}
      onChange={kv => {
        update({ inputs: kv });
      }}
      keyPlaceholder="name"
      valuePlaceholder="value"
      options={jsonTypes}
    />
    <KSVEditor
      label="Outputs"
      value={test.outputs}
      onChange={kv => {
        update({ outputs: kv });
      }}
      keyPlaceholder="name"
      valuePlaceholder="value"
      options={jsonTypes}
    />
    {/* <hr style={{ border: 0, borderTop: "1px solid #444", margin: "16px 0" }} />
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
          ) as any, 
        })
      }
      keyOptions={["repeat", "threads", "duration", "rampup"]}
    /> */}
  </div>
);

export default TestOverview;