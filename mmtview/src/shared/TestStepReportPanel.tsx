import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {ExpectItemEvent} from 'mmt-core/runConfig';
import type {TestStepResult} from 'mmt-core/reportCollector';
import { StepStatus } from './types';
import { statusIconFor, StatusIconWithCache } from './Common';
import HighlightedBody from './HighlightedBody';
import ReportStatusFilterButton from './ReportStatusFilterButton';
import ReportExpandCollapseButton from './ReportExpandCollapseButton';
import ReportEmptyFilterPlaceholder from './ReportEmptyFilterPlaceholder';
import { ReportStatusFilter, filterStepReports } from './reportStatusFilter';

/** Parsed call result details extracted from the `_` field of an API call output. */
interface CallResultDetails {
  stepKind?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, any>;
    body?: any;
    query?: Record<string, any>;
  };
  response?: {
    body?: any;
    headers?: Record<string, any>;
    status?: number;
    statusText?: string;
    duration?: number;
  };
  outputs?: Record<string, any>;
  statusCode?: number;
}
function formatStructuredValue(value: any, pretty?: boolean): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    return String(value);
  }
}

/** Render headers as a borderless key/value table (matches history panel). */
const HeadersBlock: React.FC<{ label: string; headers?: Record<string, any> }> = ({ label, headers }) => {
  if (!headers || Object.keys(headers).length === 0) { return null; }
  return (
    <div className="report-headers-block">
      <span className="highlighted-body-label">{label}</span>
      <div className="report-headers-content">
        <table className="report-headers-table">
          <tbody>
            {Object.entries(headers).map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{formatStructuredValue(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** Colored body preview with Format/Raw and copy. */
const BodyBlock: React.FC<{ label: string; body?: any; headers?: Record<string, any> }> = ({
  label,
  body,
  headers,
}) => {
  if (!body) { return null; }
  return <HighlightedBody label={label} body={body} headers={headers} />;
};

/** Try to parse a details string as a structured call result.
 *  Returns null if the details string is not a valid call-result JSON. */
function parseCallDetails(details: string | undefined): CallResultDetails | null {
  if (!details || typeof details !== 'string') { return null; }
  try {
    const parsed = JSON.parse(details);
    if (!parsed || typeof parsed !== 'object') { return null; }
    const underscore = parsed['_'];
    // Detect: has _ object with details or status
    if (!underscore || typeof underscore !== 'object') {
      return null;
    }
    if (typeof underscore.details !== 'string' && underscore.status === undefined) {
      return null;
    }
    const result: CallResultDetails = {};
    if (typeof underscore.stepKind === 'string') {
      result.stepKind = underscore.stepKind;
    }
    if (underscore.status !== undefined) {
      result.statusCode = underscore.status;
    }
    if (typeof underscore.details === 'string') {
      try {
        const inner = JSON.parse(underscore.details);
        if (inner && typeof inner === 'object') {
          if (typeof (inner as any).stepKind === 'string') {
            result.stepKind = (inner as any).stepKind;
          }
          if (inner.request) { result.request = inner.request; }
          if (inner.response) { result.response = inner.response; }
        }
      } catch { /* ignore nested parse failure */ }
    }
    const reportOutputKeys = Array.isArray((underscore as any).reportOutputKeys)
      ? new Set((underscore as any).reportOutputKeys.filter((key: any) => typeof key === 'string'))
      : null;
    const outputs: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k !== '_' && (!reportOutputKeys || reportOutputKeys.has(k))) {
        outputs[k] = v;
      }
    }
    if (Object.keys(outputs).length > 0) {
      result.outputs = outputs;
    }
    return result;
  } catch {
    return null;
  }
}

/** Section title label rendered above a separator line. */
const SectionTitle: React.FC<{ label: string; first?: boolean }> = ({ label, first }) => (
  <div className={`report-section${first ? ' is-first' : ''}`}>
    <span className="highlighted-body-label">{label}</span>
    <hr className="report-section-rule" />
  </div>
);

/** Render the structured call details. */
const StructuredDetails: React.FC<{ callDetails: CallResultDetails }> = ({ callDetails }) => {
  let sectionIdx = 0;
  const showStepIo = callDetails.stepKind !== 'http';

  return (
    <div className="report-selectable report-stack">
      {/* Status code */}
      {callDetails.statusCode !== undefined && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Status Code" first={first} />
            <div className="report-mono">
              <span style={{ color: callDetails.statusCode >= 200 && callDetails.statusCode < 300 ? '#23d18b' : callDetails.statusCode >= 400 ? '#f85149' : undefined }}>
                {callDetails.statusCode}
              </span>
              {callDetails.response?.statusText ? ` ${callDetails.response.statusText}` : ''}
              {callDetails.response?.duration !== undefined && (
                <span className="report-duration">{callDetails.response.duration}ms</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Inputs (query parameters from the request) */}
      {showStepIo && callDetails.request?.query && Object.keys(callDetails.request.query).length > 0 && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Inputs" first={first} />
            <div className="report-mono">
              {Object.entries(callDetails.request.query).map(([k, v]) => (
                <div key={k} className="field-inline">
                  <span className="muted">{k}:</span>
                  <span className="break-all">{formatStructuredValue(v)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Outputs */}
      {showStepIo && callDetails.outputs && Object.keys(callDetails.outputs).length > 0 && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Outputs" first={first} />
            <div className="report-mono">
              {Object.entries(callDetails.outputs).map(([k, v]) => (
                <div key={k} className="field-inline">
                  <span className="muted">{k}:</span>
                  <span className="break-all">{formatStructuredValue(v)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Request */}
      {callDetails.request && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Request" first={first} />
            <div className="report-indent">
              <div className="report-mono is-bare">
                {callDetails.request.method && callDetails.request.url && (
                  <div className="break-all"><span className="report-method">{callDetails.request.method.toUpperCase()}</span> {callDetails.request.url}</div>
                )}
              </div>
              <HeadersBlock label="Headers" headers={callDetails.request.headers} />
              <BodyBlock label="Body" body={callDetails.request.body} headers={callDetails.request.headers} />
            </div>
          </div>
        );
      })()}

      {/* Response */}
      {callDetails.response && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Response" first={first} />
            <div className="report-indent">
              <HeadersBlock label="Headers" headers={callDetails.response.headers} />
              <BodyBlock label="Body" body={callDetails.response.body} headers={callDetails.response.headers} />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export type ExpectReportItem = Omit<ExpectItemEvent, 'status'> & {
  status: StepStatus;
};

export type StepReportItem = Omit<TestStepResult, 'status'|'expects'> & {
  status: StepStatus;
  expects: ExpectReportItem[];
};

interface TestStepReportPanelProps {
  isExpanded: boolean;
  onToggleExpanded?: (next: boolean) => void;
  stepReports: StepReportItem[];
  runState: StepStatus;
  onRun?: () => void;
  runButtonLabel?: string;
  disabledRun?: boolean;
  showHeader?: boolean;
  showTimestamps?: boolean;
  /** When true (default with showHeader), show All/Passed/Failed view filter. */
  showStatusFilter?: boolean;
}

const TestStepReportPanel: React.FC<TestStepReportPanelProps> = (props) => {
  const {
    isExpanded,
    stepReports,
    runState,
    showHeader = true,
    showTimestamps = true,
    showStatusFilter = showHeader,
  } = props;
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
  const stepCountRef = useRef(0);

  useEffect(() => {
    stepCountRef.current = stepReports.length;
  }, [stepReports.length]);

  useEffect(() => {
    if (!isExpanded) {
      setExpandedDetails({});
    }
  }, [isExpanded]);

  const visibleReports = useMemo(
    () => filterStepReports(stepReports, statusFilter),
    [stepReports, statusFilter]
  );

  const detailKeys = useMemo(() => {
    return visibleReports
      .map((report, reportIdx) => {
        const reportKey = `${report.stepType}-${report.stepIndex}-${reportIdx}`;
        const callDetails = parseCallDetails(report.details);
        const hasDetails = Boolean(
          report.expects.length > 0 ||
          callDetails ||
          (report.details && report.details.trim().length > 0)
        );
        return hasDetails ? reportKey : null;
      })
      .filter((key): key is string => Boolean(key));
  }, [visibleReports]);

  const expandAllDetails = useCallback(() => {
    setExpandedDetails((prev) => {
      const next = { ...prev };
      for (const key of detailKeys) {
        next[key] = true;
      }
      return next;
    });
  }, [detailKeys]);

  const collapseAllDetails = useCallback(() => {
    setExpandedDetails({});
  }, []);

  const hasExpandableDetails = detailKeys.length > 0;
  const allDetailsCollapsed = hasExpandableDetails && detailKeys.every((key) => !expandedDetails[key]);

  const unescapeCommon = useCallback((s: string): string => {
    if (!s) {
      return s;
    }
    return s.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }, []);



  if (!isExpanded) {
    return null;
  }

  const filterControl = showStatusFilter ? (
    <div className="report-section-header-actions">
      <ReportStatusFilterButton
        value={statusFilter}
        onChange={setStatusFilter}
        disabled={stepReports.length === 0}
      />
      <ReportExpandCollapseButton
        allCollapsed={allDetailsCollapsed}
        onExpandAll={expandAllDetails}
        onCollapseAll={collapseAllDetails}
        disabled={detailKeys.length === 0}
      />
    </div>
  ) : null;

  return (
    <div className={showStatusFilter ? 'mmt-fill' : 'mmt-fill field-block'}>
      {showStatusFilter && (
        <div className="report-section-header">
          {showHeader ? <div className="label">Report</div> : <span />}
          {filterControl}
        </div>
      )}

      <div className="report-steps">
        {stepReports.length === 0 ? (
          <div className="muted">
            {runState === 'running' ? 'Waiting for checks and asserts to report…' : 'No check/assert results yet.'}
          </div>
        ) : visibleReports.length === 0 ? (
          <ReportEmptyFilterPlaceholder
            filter={statusFilter}
            onShowAll={() => setStatusFilter('all')}
          />
        ) : (
          <div className="report-selectable report-step-list">
            {visibleReports.map((report, reportIdx) => {
              const isDebug = report.stepType === 'debug';
              // Stable key: timestamp remounts wipe selection / collapse details.
              const reportKey = `${report.stepType}-${report.stepIndex}-${reportIdx}`;
              const callDetails = parseCallDetails(report.details);
              const hasExpects = report.expects.length > 0;
              const hasDetails = Boolean(
                hasExpects ||
                callDetails ||
                (report.details && report.details.trim().length > 0)
              );
              const isDetailsExpanded = Boolean(expandedDetails[reportKey]);
              const toggleDetails = () => {
                if (!hasDetails) {
                  return;
                }
                setExpandedDetails((prev) => ({ ...prev, [reportKey]: !isDetailsExpanded }));
              };
              const onHeaderActivate = (event: React.MouseEvent | React.KeyboardEvent) => {
                if (!hasDetails) {
                  return;
                }
                if ('key' in event) {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }
                  event.preventDefault();
                } else {
                  const sel = window.getSelection();
                  if (sel && !sel.isCollapsed && sel.toString().trim()) {
                    return;
                  }
                }
                toggleDetails();
              };
              return (
                <div
                  key={reportKey}
                  className="report-step"
                >
                  <div
                    role={hasDetails ? 'button' : undefined}
                    tabIndex={hasDetails ? 0 : undefined}
                    title={hasDetails ? (isDetailsExpanded ? 'Hide details' : 'Show details') : undefined}
                    onClick={onHeaderActivate}
                    onKeyDown={onHeaderActivate}
                    className={`report-step-head${hasDetails ? ' is-clickable' : ''}`}
                  >
                    <span className="tree-view-box-row-arrow" aria-hidden>
                      {hasDetails ? (
                        <span
                          className={`codicon ${isDetailsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'} report-chevron`}
                        />
                      ) : null}
                    </span>
                    <StatusIconWithCache
                      status={isDebug ? 'debug' : report.status}
                      cached={report.cached === true}
                    />
                    <span className="report-selectable field-grow ellipsis">
                      {report.title || (isDebug ? 'Debug' : report.stepType === 'check' ? 'Check' : 'Assert')}
                    </span>
                    {showTimestamps && (
                      <span className="report-step-time">
                        {new Date(report.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {isDetailsExpanded && (
                    <div
                      className="report-step-body"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                        {hasExpects && (() => {
                          const softItems = report.expects.filter(i => i.level !== 'require');
                          const hardItems = report.expects.filter(i => i.level === 'require');
                          const renderItems = (items: ExpectReportItem[], sectionLabel: string, first: boolean) => {
                            if (items.length === 0) {
                              return null;
                            }
                            return (
                              <div>
                                <SectionTitle
                                  label={sectionLabel}
                                  first={first}
                                />
                                <div className="report-expect-list">
                                  {items.map((item, idx) => {
                                    const itemMeta = isDebug ? statusIconFor('debug') : statusIconFor(item.status);
                                    const showActualDetails = !isDebug && (typeof item.similarity === 'number' || typeof item.count === 'number') && item.actual !== undefined && item.expected !== undefined;
                                    const showFailureDetails = !isDebug && item.status === 'failed' && item.actual !== undefined && item.expected !== undefined;
                                    return (
                                      <div key={idx} className="report-expect">
                                        <div className="tree-row">
                                          <span
                                            className={`codicon ${itemMeta.icon} report-expect-icon`}
                                            style={{ color: itemMeta.color }}
                                            aria-label={itemMeta.title}
                                          ></span>
                                          <span className="report-expect-text">{item.comparison}</span>
                                        </div>
                                        {(showActualDetails || showFailureDetails) && (
                                          <>
                                            <span className="report-expect-meta">got: {typeof item.actual === 'object' ? JSON.stringify(item.actual) : String(item.actual)}</span>
                                            {typeof item.similarity === 'number' && (
                                              <span className="report-expect-meta">similarity: {item.similarity}%</span>
                                            )}
                                            {typeof item.count === 'number' && (
                                              <span className="report-expect-meta">count: {item.count}</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          };
                          const softLabel = isDebug
                            ? 'Debug'
                            : (softItems.length === 1 ? 'Expect' : 'Expects');
                          const hardLabel = hardItems.length === 1 ? 'Require' : 'Requires';
                          return (
                            <div>
                              {renderItems(softItems, softLabel, true)}
                              {renderItems(hardItems, hardLabel, softItems.length === 0)}
                            </div>
                          );
                        })()}
                        {callDetails ? (
                          <StructuredDetails callDetails={callDetails} />
                        ) : (
                          report.details && report.details.trim().length > 0 && (
                            <pre className="report-selectable report-details-pre">
                              {unescapeCommon(String(report.details))}
                            </pre>
                          )
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TestStepReportPanel);
