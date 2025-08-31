import React from "react";
import { FlowType, CheckOps, TestData } from "./TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";

interface TestFlowBoxProps {
  type: FlowType;
  step: any;
  testData: TestData,
  onChange: (value: any) => void;
}
const TestFlowBox: React.FC<TestFlowBoxProps> = ({ type, step, testData, onChange }) => {
  switch (type) {
    case "call":
      return (
        <TestCall
          value={step || ""}
          imports={typeof testData.import === "object" ? testData.import : undefined}
          onChange={(yamlString) => onChange(yamlString)}
          placeholder="select a call"
        />
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
    case "if": {
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
    case "for":
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