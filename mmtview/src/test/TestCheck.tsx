import React from "react";
import { CheckOps, opsList, opsNames, ReportLevel, ReportConfig } from "mmt-core/TestData";
import { safeList } from "mmt-core/safer";

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
      {expanded && (
        <>
          <div className="label">Title</div>
          <div style={{ padding: '5px' }}>
            <input
              value={title}
              placeholder="Title (shown inline)"
              style={{ width: '100%' }}
              onChange={e => update({ title: e.target.value })}
            />
          </div>
          <div className="label">Details</div>
          <div style={{ padding: '5px' }}>
            <textarea
              value={details}
              placeholder="Details (shown in the details panel)"
              style={{ width: '100%', height: 60, resize: 'vertical' }}
              onChange={e => update({ details: e.target.value })}
            />
          </div>
          <div className="label">Report</div>
          <div style={{ padding: '5px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label 
                htmlFor="mmt-report-internal"
                title="Report level when running this test directly"
                style={{ userSelect: 'none', fontSize: 12 }}
              >
                Internal:
              </label>
              <select
                id="mmt-report-internal"
                value={internalValue}
                onChange={e => updateReport(e.target.value as ReportLevel, externalValue)}
                style={{ fontSize: 12 }}
              >
                {reportLevelOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <label 
                htmlFor="mmt-report-external"
                title="Report level when this test is imported or added to a suite"
                style={{ userSelect: 'none', fontSize: 12 }}
              >
                External:
              </label>
              <select
                id="mmt-report-external"
                value={externalValue}
                onChange={e => updateReport(internalValue, e.target.value as ReportLevel)}
                style={{ fontSize: 12 }}
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