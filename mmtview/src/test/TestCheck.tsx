import React from "react";
import { CheckOps, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

export interface TestCheckValue {
  left: string;
  op: CheckOps;
  right: string;
  message: string;
}

interface TestCheckProps {
  value: TestCheckValue;
  onChange: (val: TestCheckValue) => void;
}

const TestCheck: React.FC<TestCheckProps> = ({ value, onChange }) => {
  const { left, op, right, message } = value;

  const update = (patch: Partial<TestCheckValue>) => {
    onChange({ left, op, right, message, ...patch });
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", verticalAlign: "center", gap: 4, width: '100%' }}>
        <input
          value={left}
          placeholder="actual"
          style={{ width: '100%' }}
          onChange={e => update({ left: e.target.value })}
        />
        <select
          value={op}
          onChange={e => update({ op: e.target.value as CheckOps })}
          style={{ width: 80, flex: '0 0 auto' }}
        >
          {safeList(opsList).map((relation, idx) => (
            <option key={relation} value={safeList(opsList)[idx]} title={safeList(opsNames)[idx]}>
              {safeList(opsList)[idx]}
            </option>
          ))}
        </select>
        <input
          value={right}
          placeholder="expected"
          style={{ width: '100%' }}
          onChange={e => update({ right: e.target.value })}
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <input
          value={message}
          placeholder="Optional message shown when condition fails"
          style={{ width: '100%' }}
          onChange={e => update({ message: e.target.value })}
        />
      </div>
    </div>
  );
};

export default TestCheck;