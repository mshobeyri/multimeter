import React from "react";
import { CheckOps } from "mmt-core/TestData";
import OperatorSelect from "../components/OperatorSelect";
import ReportLevelFields, { type ReportValue } from "../components/ReportLevelFields";

export type { ReportValue };

export interface TestCheckValue {
  actual: string;
  op: CheckOps;
  expected: string;
  title: string;
  details: string;
  report?: ReportValue;
}

interface TestCheckProps {
  value: TestCheckValue;
  onChange: (val: TestCheckValue) => void;
  expanded?: boolean;
}

const TestCheck: React.FC<TestCheckProps> = ({ value, onChange, expanded }) => {
  const { actual, op, expected, title, details, report } = value;

  const update = (patch: Partial<TestCheckValue>) => {
    onChange({ actual, op, expected, title, details, report, ...patch });
  };

  return (
    <div className="mmt-fill">
      <div className="field-inline">
        <input
          value={actual}
          placeholder="actual"
          className="mmt-fill"
          onChange={e => update({ actual: e.target.value })}
        />
        <OperatorSelect
          value={op}
          onChange={nextOp => update({ op: nextOp })}
          className="is-fixed"
          title="Comparison operator"
        />
        <input
          value={expected}
          placeholder="expected"
          className="mmt-fill"
          onChange={e => update({ expected: e.target.value })}
        />
      </div>
      {expanded && (
        <>
          <div className="label">Title</div>
          <div className="field-pad">
            <input
              value={title}
              placeholder="Title (shown inline)"
              onChange={e => update({ title: e.target.value })}
            />
          </div>
          <div className="label">Details</div>
          <div className="field-pad">
            <textarea
              value={details}
              placeholder="Details (shown in the details panel)"
              className="field-details"
              onChange={e => update({ details: e.target.value })}
            />
          </div>
          <ReportLevelFields
            value={report}
            onChange={next => update({ report: next })}
            ids={{ internal: "mmt-report-internal", external: "mmt-report-external" }}
          />
        </>
      )}
    </div>
  );
};

export default TestCheck;
