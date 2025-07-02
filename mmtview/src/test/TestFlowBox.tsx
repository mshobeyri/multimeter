import React from "react";
import { FlowType } from "./TestData";

interface TestFlowBoxProps {
  type: FlowType;
  step: any;
  onChange: (patch: any) => void;
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({ type, step, onChange }) => {
  switch (type) {
    case "call":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="endpoint"
            value={step.endpoint || ""}
            onChange={e => onChange({ endpoint: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "check":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="check"
            value={step.check || ""}
            onChange={e => onChange({ check: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "condition":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="condition"
            value={step.condition || ""}
            onChange={e => onChange({ condition: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "loop":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="loop"
            value={step.loop || ""}
            onChange={e => onChange({ loop: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      );
    default:
      return null;
  }
};

export default TestFlowBox;