import React from "react";
import { CheckOps, opsList, opsNames } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

export interface TestCheckValue {
  actual: string;
  op: CheckOps;
  expected: string;
  title: string;
  details: string;
  report_success?: boolean;
}

interface TestCheckProps {
  value: TestCheckValue;
  onChange: (val: TestCheckValue) => void;
}

const TestCheck: React.FC<TestCheckProps> = ({ value, onChange }) => {
  const { actual, op, expected, title, details, report_success } = value;

  const update = (patch: Partial<TestCheckValue>) => {
    onChange({ actual, op, expected, title, details, report_success, ...patch });
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: "flex", verticalAlign: "center", gap: 4, width: '100%' }}>
        <input
          value={actual}
          placeholder="actual"
          style={{ width: '100%' }}
          onChange={e => update({ actual: e.target.value })}
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
          value={expected}
          placeholder="expected"
          style={{ width: '100%' }}
          onChange={e => update({ expected: e.target.value })}
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <input
          value={title}
          placeholder="Title (shown inline)"
          style={{ width: '100%' }}
          onChange={e => update({ title: e.target.value })}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <textarea
          value={details}
          placeholder="Details (shown in the details panel)"
          style={{ width: '100%', height: 60, resize: 'vertical' }}
          onChange={e => update({ details: e.target.value })}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={!!report_success}
          onChange={e => update({ report_success: e.target.checked })}
          id="mmt-report-success"
        />
        <label
          htmlFor="mmt-report-success"
          title="When enabled, emits a report event even when the check/assert passes."
          style={{ userSelect: 'none' }}
        >
          Report success
        </label>
      </div>
    </div>
  );
};

export default TestCheck;