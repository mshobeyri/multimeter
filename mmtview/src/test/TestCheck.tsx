import React from "react";
import { CheckOps, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

interface TestCheckProps {
  left: string;
  op: CheckOps;
  right: string;
  onChange: (val: { left: string; op: CheckOps; right: string }) => void;
}

const TestCheck: React.FC<TestCheckProps> = ({
  left,
  op,
  right,
  onChange,
}) => (
  <div style={{ display: "flex", verticalAlign: "center", gap: 0 }}>
    <input
      value={left}
      style={{ width: '100%' }}
      onChange={v => onChange({ left: v.target.value, op, right })}
    />
    <select
      value={op}
      onChange={e => onChange({ left, op: e.target.value as CheckOps, right })}
      style={{ width: 80, flex: '0 0 auto' }}
    >
      {safeList(opsList).map((relation, idx) => (
        <option key={relation} value={safeList(opsList)[idx]} title={safeList(opsNames)[idx]}>
          {safeList(opsList)[idx]}
        </option>
      ))}
    </select>
    <input
      value={left}
      style={{ width: '100%' }}
      onChange={e => onChange({ left, op, right: e.target.value })}
    />
  </div>
);

export default TestCheck;