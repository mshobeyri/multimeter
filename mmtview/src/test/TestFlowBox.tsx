import React from "react";
import { FlowType, CheckOps, TestData } from "mmt-core/TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";

interface TestFlowBoxProps {
  data: any,
  onChange: (value: any) => void;
}
const TestFlowBox: React.FC<TestFlowBoxProps> = ({ data, onChange }) => {
  const { type, step: stepData, testData } = data;
  switch (type) {
    case "step":
      return (
        <div style={{ marginTop: 8 }}>
          {<span>{type}</span>}
          <TestCall
            value={stepData || ""}
            imports={typeof testData.import === "object" ? testData.import : undefined}
            onChange={(yamlString) => onChange(yamlString)}
            placeholder="select a call"
          />
        </div>
      );
    case "call":
      return (
        <div style={{ marginTop: 8 }}>
          {<span>{type}</span>}
          <TestCall
            value={stepData || ""}
            imports={typeof testData.import === "object" ? testData.import : undefined}
            onChange={(yamlString) => onChange(yamlString)}
            placeholder="select a call"
          />
        </div>
      );
    case "check": {
      // Parse step as "left op right"
      let left = "?", op: CheckOps = "==" as CheckOps, right = "?";
      if (typeof stepData === "string") {
        const match = stepData.match(/^(\S*)\s+([=!<>$@^~]+)\s+(\S*)$/);
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {<span>{type}</span>}
          <TestCheck
            left={left}
            op={op}
            right={right}
            onChange={({ left, op, right }) => onChange(`${left} ${op} ${right}`)}
          />
        </div>
      );
    }
    case "if": {
      // Parse step as "left op right"
      let left = "?", op: CheckOps = "==" as CheckOps, right = "?";
      if (typeof stepData === "string") {
        const match = stepData.match(/^(\S*)\s+([=!<>$@^~]+)\s+(\S*)$/);
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {<span>{type}</span>}
          <TestCheck
            left={left}
            op={op}
            right={right}
            onChange={({ left, op, right }) => onChange(`${left} ${op} ${right}`)}
          />
        </div>
      );
    }
    case "for":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <input
            placeholder="100, 10s, 5-10, i:data"
            value={stepData || ""}
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