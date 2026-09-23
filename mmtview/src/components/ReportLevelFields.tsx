import React from "react";
import { ReportConfig, ReportLevel } from "mmt-core/TestData";

export type ReportValue = ReportLevel | ReportConfig | undefined;

export const REPORT_LEVEL_OPTIONS: ReportLevel[] = ["all", "fails", "none"];

export function parseReportValue(report: ReportValue): {
  internal: ReportLevel;
  external: ReportLevel;
} {
  const isObjectForm = report && typeof report === "object";
  return {
    internal: isObjectForm
      ? (report as ReportConfig).internal ?? "all"
      : (typeof report === "string" ? report : "all"),
    external: isObjectForm
      ? (report as ReportConfig).external ?? "fails"
      : (typeof report === "string" ? report : "fails"),
  };
}

export function normalizeReportValue(
  internal: ReportLevel,
  external: ReportLevel,
): ReportValue {
  if (internal === "all" && external === "fails") {
    return undefined;
  }
  if (internal === external) {
    return internal;
  }
  return { internal, external };
}

type ReportLevelFieldsProps = {
  value: ReportValue;
  onChange: (next: ReportValue) => void;
  /** `colon` matches check/http/call; `plain` matches judge. */
  labels?: "colon" | "plain";
  ids?: { internal?: string; external?: string };
  showLabel?: boolean;
};

const ReportLevelFields: React.FC<ReportLevelFieldsProps> = ({
  value,
  onChange,
  labels = "colon",
  ids,
  showLabel = true,
}) => {
  const { internal, external } = parseReportValue(value);

  const setLevels = (nextInternal: ReportLevel, nextExternal: ReportLevel) => {
    onChange(normalizeReportValue(nextInternal, nextExternal));
  };

  const options = REPORT_LEVEL_OPTIONS.map(opt => (
    <option key={opt} value={opt}>{opt}</option>
  ));

  return (
    <>
      {showLabel && <div className="label">Report</div>}
      <div className="report-row">
        {labels === "plain" ? (
          <>
            <label className="report-item">
              internal
              <select
                id={ids?.internal}
                value={internal}
                onChange={e => setLevels(e.target.value as ReportLevel, external)}
              >
                {options}
              </select>
            </label>
            <label className="report-item">
              external
              <select
                id={ids?.external}
                value={external}
                onChange={e => setLevels(internal, e.target.value as ReportLevel)}
              >
                {options}
              </select>
            </label>
          </>
        ) : (
          <>
            <div className="report-item">
              <label
                htmlFor={ids?.internal}
                title="Report level when running this test directly"
              >
                Internal:
              </label>
              <select
                id={ids?.internal}
                value={internal}
                onChange={e => setLevels(e.target.value as ReportLevel, external)}
              >
                {options}
              </select>
            </div>
            <div className="report-item">
              <label
                htmlFor={ids?.external}
                title="Report level when this test is imported or added to a suite"
              >
                External:
              </label>
              <select
                id={ids?.external}
                value={external}
                onChange={e => setLevels(internal, e.target.value as ReportLevel)}
              >
                {options}
              </select>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ReportLevelFields;
