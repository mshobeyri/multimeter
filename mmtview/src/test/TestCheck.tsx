import React from "react";
import AutoSizeTextField from "../components/AutoSizeTextField";
import { CheckOps, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

interface TestCheckProps {
  left: string;
  op: CheckOps;
  right: string;
  onChange: (val: { left: string; op: CheckOps; right: string }) => void;
  minWidth?: number;
  maxWidth?: number;
}

const TestCheck: React.FC<TestCheckProps> = ({
  left,
  op,
  right,
  onChange,
  minWidth = 110,
  maxWidth = 110,
}) => (
  <div style={{ display: "flex", verticalAlign: "center", gap: 0 }}>
    <AutoSizeTextField
      value={left}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onChange={v => onChange({ left: v, op, right })}
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
    <AutoSizeTextField
      value={right}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onChange={v => onChange({ left, op, right: v })}
    />
  </div>
);

export default TestCheck;