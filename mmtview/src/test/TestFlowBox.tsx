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

  switch (type as FlowType) {
    case "step":
    case "call":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <TestCall
            value={stepData || ""}
            imports={typeof testData?.import === "object" ? testData.import : undefined}
            onChange={yamlString => onChange(yamlString)}
            placeholder="select a call"
          />
        </div>
      );
    case "check":
    case "if":
    case "assert": {
      let left = "?", op: CheckOps = "==" as CheckOps, right = "?";
      if (typeof stepData === "string") {
        const match = stepData.match(/^(\S*)\s+([=!<>$@^~]+)\s+(\S*)$/);
        if (match) {
          left = match[1];
          op = match[2] as CheckOps;
          right = match[3];
        }
      }
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
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
    case "repeat":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <input
            placeholder={type === "for" ? "100, 10s, 5-10, i:data" : "repeat count or duration"}
            value={stepData || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "js":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <input
            placeholder="JavaScript code"
            value={stepData || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "print":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <input
            placeholder="Message to print"
            value={stepData || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "set":
    case "var":
    case "const":
    case "let":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <textarea
            placeholder="key: value pairs (YAML or JSON)"
            value={typeof stepData === "string" ? stepData : JSON.stringify(stepData, null, 2)}
            onChange={e => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
            style={{ width: "100%", minHeight: 32 }}
          />
        </div>
      );
    case "end":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontStyle: "italic", color: "#888" }}>
          <span>{type}</span>
        </div>
      );
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{type}</span>
          <input
            value={stepData || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
  }
};

export default TestFlowBox;