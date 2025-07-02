import React from "react";
import { FlowType } from "./TestData";

interface TestFlowBoxProps {
  type: FlowType;
  step: any; // This is the value, not an object!
  onChange: (value: any) => void;
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({ type, step, onChange }) => {
  switch (type) {
    case "call":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="endpoint"
            value={step || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "check":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="a=b, a!=b, a>5, a<10"
            value={step || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "condition":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="a=b, a!=b, a>5, a<10"
            value={step || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "loop":
      return (
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="100, 10s, 5-10, i:data"
            value={step || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    default:
      return null;
  }
};

export default TestFlowBox;