import React from "react";
import { CheckOps, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

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
    <select
      value={op}
      onChange={e => onChange({ actual, op: e.target.value as CheckOps, expected })}
      style={{ width: 80, flex: '0 0 auto' }}
    >
      {safeList(opsList).map((relation, idx) => (
        <option key={relation} value={safeList(opsList)[idx]} title={safeList(opsNames)[idx]}>
          {safeList(opsList)[idx]}
        </option>
      ))}
    </select>
    <input
      value={expected}
      style={{ width: '100%' }}
      onChange={e => onChange({ actual, op, expected: e.target.value })}
    />
  </div>
);

export default TestIf;