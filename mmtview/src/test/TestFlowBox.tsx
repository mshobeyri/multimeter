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
  const parseLiteral = (text: string): any => {
    const t = (text ?? '').trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    if (/^(true|false)$/i.test(t)) {
      return /^true$/i.test(t);
    }
    if (/^-?\d+(?:\.\d+)?$/.test(t)) {
      const n = Number(t);
      if (!Number.isNaN(n)) return n;
    }
    return text;
  };
  switch (type as FlowType) {
    case "call":
      return (
        <div className="test-flow-box-items">
          <span style={{ paddingTop: "6px" }}>{type}</span>
          <TestCall
            value={stepData}
            imports={typeof testData?.import === "object" ? testData.import : undefined}
            onChange={callObj => onChange({ ...callObj })}
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
            onChange={({ left, op, right }) => onChange({ [type]: `${left} ${op} ${right}` })}
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
            onChange={e => onChange({ [type]: e.target.value })}
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
            onChange={e => onChange({ js: e.target.value })}
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
            onChange={e => onChange({ print: e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      );
    case "set":
    case "var":
    case "const":
    case "let": {
      const currentType = type as "set" | "var" | "const" | "let";
      const payload = (stepData && typeof stepData === 'object') ? stepData[currentType] : undefined;
      const key = payload && typeof payload === 'object' ? Object.keys(payload)[0] || '' : '';
      const valRaw = key ? (payload as any)[key] : '';
      const val = typeof valRaw === 'string' ? valRaw : (valRaw != null ? JSON.stringify(valRaw) : '');

      const handleKindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newKind = e.target.value as 'set' | 'var' | 'const' | 'let';
        const nextObj = key ? { [newKind]: { [key]: parseLiteral(val) } } : { [newKind]: {} } as any;
        onChange(nextObj);
      };
      const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newKey = e.target.value;
        const nextPayload = newKey ? { [newKey]: parseLiteral(val) } : {};
        onChange({ [currentType]: nextPayload });
      };
      const handleValChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        const nextPayload = key ? { [key]: parseLiteral(newVal) } : {};
        onChange({ [currentType]: nextPayload });
      };

      return (
        <div className="test-flow-box-items" style={{ gap: 8, width: '100%' }}>
          <select value={currentType} onChange={handleKindChange} style={{ minWidth: 72 }}>
            <option value="set">set</option>
            <option value="var">var</option>
            <option value="const">const</option>
            <option value="let">let</option>
          </select>
          <input
            placeholder="property (e.g., outputs.name)"
            value={key}
            onChange={handleKeyChange}
            style={{ width: '40%' }}
          />
          <input
            placeholder="value (e.g., user_info.name or 'text')"
            value={val}
            onChange={handleValChange}
            style={{ width: '60%' }}
          />
        </div>
      );
    }
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
            onChange={e => onChange({ stage: e.target.value })}
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