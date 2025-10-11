import React from "react";
import { FlowType, CheckOps, TestData } from "mmt-core/TestData";
import TestCheck from "./TestCheck";
import TestCall from "./TestCall";

interface TestFlowBoxProps {
  data: any,
  onChange: (value: any) => void;
}

const TestFlowBox: React.FC<TestFlowBoxProps> = ({ data, onChange }) => {
  const { type, stepData, testData } = data;
  console.log("data", data)
  switch (type as FlowType) {
    case "call":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <TestCall
            value={stepData}
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
      const match = stepData[type].split(" ");
      left = match[0];
      op = match[1] as CheckOps;
      right = match[2];

      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
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
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <input
            placeholder={type === "for" ? "100, 10s, 5-10, i:data" : "repeat count or duration"}
            value={stepData[type] || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "js":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <textarea
            placeholder="JavaScript code"
            value={stepData[type] || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%", height: "calc(100% - 14px)" }}
          />
        </div>
      );
    case "print":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <input
            placeholder="Message to print"
            value={stepData[type] || ""}
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
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
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
    case "steps":
    case "stages":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
        </div>
      );
    case "stage":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <input
            placeholder="Stage name"
            value={stepData[type] || ""}
            onChange={e => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      );
    default:
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
        </div>
      );
  }
};

export default TestFlowBox;