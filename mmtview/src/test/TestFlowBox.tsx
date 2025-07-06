import React from "react";
import { FlowType, CheckOps } from "./TestData";
import TestCheck from "./TestCheck";

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
    case "check": {
      // Parse step as "left op right"
      let left = "?", op: CheckOps = "==" as CheckOps, right = "?";
      if (typeof step === "string") {
        const match = step.match(/^(\S*)\s+([=!<>$@^~]+)\s+(\S*)$/);
        if (match) {
          left = match[1];
          op = match[2] as CheckOps;
          right = match[3];
        } else {
          left = "?";
          op = "=" as CheckOps;
          right = "?";
        }
      }
      return (
        <div style={{ marginTop: 8 }}>
          <TestCheck
            left={left}
            op={op}
            right={right}
            onChange={({ left, op, right }) => onChange(`${left} ${op} ${right}`)}
          />
        </div>
      );
    }
    case "condition":{
      // Parse step as "left op right"
      let left = "?", op: CheckOps = "==" as CheckOps, right = "?";
      if (typeof step === "string") {
        const match = step.match(/^(\S*)\s+([=!<>$@^~]+)\s+(\S*)$/);
        if (match) {
          left = match[1];
          op = match[2] as CheckOps;
          right = match[3];
        } else {
          left = "?";
          op = "=" as CheckOps;
          right = "?";
        }
      }
      return (
        <div style={{ marginTop: 8 }}>
          <TestCheck
            left={left}
            op={op}
            right={right}
            onChange={({ left, op, right }) => onChange(`${left} ${op} ${right}`)}
          />
        </div>
      );
    }
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