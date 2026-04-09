import React from "react";
import { CheckOps } from "mmt-core/TestData";
import OperatorSelect from "../components/OperatorSelect";

interface TestIfProps {
  actual: string;
  op: CheckOps;
  expected: string;
  onChange: (val: { actual: string; op: CheckOps; expected: string }) => void;
}

const TestIf: React.FC<TestIfProps> = ({
  actual,
  op,
  expected,
  onChange,
}) => (
  <div style={{ display: "flex", verticalAlign: "center", gap: 0, width: '100%' }}>
    <input
      value={actual}
      style={{ width: '100%' }}
      onChange={v => onChange({ actual: v.target.value, op, expected })}
    />
    <OperatorSelect
      value={op}
      onChange={nextOp => onChange({ actual, op: nextOp, expected })}
      style={{ width: 190, flex: '0 0 auto' }}
      title="Comparison operator"
    />
    <input
      value={expected}
      style={{ width: '100%' }}
      onChange={e => onChange({ actual, op, expected: e.target.value })}
    />
  </div>
);

export default TestIf;