import React from "react";
import { CheckOps, ReportLevel, ReportConfig } from "mmt-core/TestData";
import OperatorSelect from "../components/OperatorSelect";

export type ReportValue = ReportLevel | ReportConfig | undefined;

export interface TestCheckValue {
  actual: string;
  op: CheckOps;
  expected: string;
  title: string;
  details: string;
  report?: ReportValue;
}

const reportLevelOptions: ReportLevel[] = ['all', 'fails', 'none'];

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

  // Parse current report value
  const isObjectForm = report && typeof report === 'object';
  const internalValue: ReportLevel = isObjectForm 
    ? (report as ReportConfig).internal ?? 'all' 
    : (typeof report === 'string' ? report : 'all');
  const externalValue: ReportLevel = isObjectForm 
    ? (report as ReportConfig).external ?? 'fails' 
    : (typeof report === 'string' ? report : 'fails');

  const updateReport = (internal: ReportLevel, external: ReportLevel) => {
    // If both are defaults, set to undefined
    if (internal === 'all' && external === 'fails') {
      update({ report: undefined });
    } else if (internal === external) {
      // Shorthand if both are the same
      update({ report: internal });
    } else {
      update({ report: { internal, external } });
    }
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
          <div className="label">Report</div>
          <div className="report-row">
            <div className="report-item">
              <label 
                htmlFor="mmt-report-internal"
                title="Report level when running this test directly"
              >
                Internal:
              </label>
              <select
                id="mmt-report-internal"
                value={internalValue}
                onChange={e => updateReport(e.target.value as ReportLevel, externalValue)}
              >
                {reportLevelOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="report-item">
              <label 
                htmlFor="mmt-report-external"
                title="Report level when this test is imported or added to a suite"
              >
                External:
              </label>
              <select
                id="mmt-report-external"
                value={externalValue}
                onChange={e => updateReport(internalValue, e.target.value as ReportLevel)}
              >
                {reportLevelOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TestCheck;
