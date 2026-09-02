import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StepStatus } from './types';
import { statusIconFor, StatusIconWithCache } from './Common';
import HighlightedBody from './HighlightedBody';
import ReportStatusFilterButton from './ReportStatusFilterButton';
import ReportHeaderMoreMenu from './ReportHeaderMoreMenu';
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
    <div className="report-headers-block" style={{ marginTop: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>{label}</span>
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
  <div style={{ marginTop: first ? 4 : 10 }}>
    <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>{label}</span>
    <hr style={{
      border: 'none',
      borderTop: '1px solid var(--vscode-editorWidget-border, #444)',
      margin: '2px 0 4px 0',
      opacity: 0.5,
    }} />
  </div>
);

/** Render the structured call details. */
const StructuredDetails: React.FC<{ callDetails: CallResultDetails }> = ({ callDetails }) => {
  let sectionIdx = 0;
  const showStepIo = callDetails.stepKind !== 'http';

  return (
    <div className="report-selectable" style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
      {/* Status code */}
      {callDetails.statusCode !== undefined && (() => {
        const first = sectionIdx++ === 0;
        return (
          <div>
            <SectionTitle label="Status Code" first={first} />
            <div style={{
              padding: '2px 12px', borderRadius: 4,
              background: 'var(--vscode-editor-background, #1e1e1e)',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              fontSize: 'var(--vscode-editor-font-size, 12px)',
            }}>
              <span style={{ color: callDetails.statusCode >= 200 && callDetails.statusCode < 300 ? '#23d18b' : callDetails.statusCode >= 400 ? '#f85149' : undefined }}>
                {callDetails.statusCode}
              </span>
              {callDetails.response?.statusText ? ` ${callDetails.response.statusText}` : ''}
              {callDetails.response?.duration !== undefined && (
                <span style={{ opacity: 0.6, marginLeft: 8 }}>{callDetails.response.duration}ms</span>
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
            <div style={{
              padding: '2px 12px', borderRadius: 4,
              background: 'var(--vscode-editor-background, #1e1e1e)',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              fontSize: 'var(--vscode-editor-font-size, 12px)',
            }}>
              {Object.entries(callDetails.request.query).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 4 }}>
                  <span style={{ opacity: 0.7 }}>{k}:</span>
                  <span style={{ wordBreak: 'break-all' }}>{formatStructuredValue(v)}</span>
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
            <div style={{
              padding: '2px 12px', borderRadius: 4,
              background: 'var(--vscode-editor-background, #1e1e1e)',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              fontSize: 'var(--vscode-editor-font-size, 12px)',
            }}>
              {Object.entries(callDetails.outputs).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 4 }}>
                  <span style={{ opacity: 0.7 }}>{k}:</span>
                  <span style={{ wordBreak: 'break-all' }}>{formatStructuredValue(v)}</span>
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
            <div style={{ paddingLeft: 12 }}>
              <div style={{
                padding: '2px 0', borderRadius: 4,
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                fontSize: 'var(--vscode-editor-font-size, 12px)',
              }}>
                {callDetails.request.method && callDetails.request.url && (
                  <div style={{ wordBreak: 'break-all' }}><span style={{ fontWeight: 600 }}>{callDetails.request.method.toUpperCase()}</span> {callDetails.request.url}</div>
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
            <div style={{ paddingLeft: 12 }}>
              <HeadersBlock label="Headers" headers={callDetails.response.headers} />
              <BodyBlock label="Body" body={callDetails.response.body} headers={callDetails.response.headers} />
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export interface ExpectReportItem {
  comparison: string;
  actual?: any;
  expected?: any;
  status: StepStatus;
  similarity?: number;
  count?: number;
}

export interface StepReportItem {
  stepIndex: number;
  stepType: 'check' | 'assert' | 'debug';
  status: StepStatus;
  title?: string;
  details?: string;
  expects: ExpectReportItem[];
  timestamp: number;
  /** True when the related call returned outputs from the in-run test call cache. */
  cached?: boolean;
}

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
      <ReportHeaderMoreMenu
        onExpandAll={expandAllDetails}
        onCollapseAll={collapseAllDetails}
        disabled={detailKeys.length === 0}
      />
    </div>
  ) : null;

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', marginTop: showStatusFilter ? 0 : 8 }}>
      {showStatusFilter && (
        <div className="report-section-header">
          {showHeader ? <div className="label">Report</div> : <span />}
          {filterControl}
        </div>
      )}

      <div
        style={{
          minHeight: 160,
          border: '1px solid var(--vscode-editorWidget-border, #2a2a2a)',
          borderRadius: 6,
          padding: 12,
          background: 'transparent',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        {stepReports.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            {runState === 'running' ? 'Waiting for checks and asserts to report…' : 'No check/assert results yet.'}
          </div>
        ) : visibleReports.length === 0 ? (
          <ReportEmptyFilterPlaceholder
            filter={statusFilter}
            onShowAll={() => setStatusFilter('all')}
          />
        ) : (
          <div className="report-selectable" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  style={{
                    border: '1px solid var(--vscode-editorWidget-border, #2a2a2a)',
                    backgroundColor: 'transparent',
                    borderRadius: 6,
                  }}
                >
                  <div
                    role={hasDetails ? 'button' : undefined}
                    tabIndex={hasDetails ? 0 : undefined}
                    title={hasDetails ? (isDetailsExpanded ? 'Hide details' : 'Show details') : undefined}
                    onClick={onHeaderActivate}
                    onKeyDown={onHeaderActivate}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: hasDetails ? 'pointer' : 'default',
                    }}
                  >
                    <span className="tree-view-box-row-arrow" aria-hidden>
                      {hasDetails ? (
                        <span
                          className={`codicon ${isDetailsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                          style={{ fontSize: 16, lineHeight: 1, display: 'inline-flex' }}
                        />
                      ) : null}
                    </span>
                    <StatusIconWithCache
                      status={isDebug ? 'debug' : report.status}
                      cached={report.cached === true}
                    />
                    <span
                      className="report-selectable"
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
                    >
                      {report.title || (isDebug ? 'Debug' : report.stepType === 'check' ? 'Check' : 'Assert')}
                    </span>
                    {showTimestamps && (
                      <span style={{ opacity: 0.7, fontSize: 12, flexShrink: 0 }}>
                        {new Date(report.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {isDetailsExpanded && (
                    <div
                      style={{ margin: '0 12px 8px', paddingLeft: 32 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                        {hasExpects && (
                          <div>
                            <SectionTitle label={isDebug ? 'Debug' : (report.expects.length === 1 ? 'Expect' : 'Expects')} />
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {report.expects.map((item, idx) => {
                              const itemMeta = isDebug ? statusIconFor('debug') : statusIconFor(item.status);
                              const showActualDetails = !isDebug && (typeof item.similarity === 'number' || typeof item.count === 'number') && item.actual !== undefined && item.expected !== undefined;
                              const showFailureDetails = !isDebug && item.status === 'failed' && item.actual !== undefined && item.expected !== undefined;
                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      className={`codicon ${itemMeta.icon}`}
                                      style={{ color: itemMeta.color, fontSize: 12 }}
                                      aria-label={itemMeta.title}
                                    ></span>
                                    <span style={{
                                      fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                      fontSize: 'var(--vscode-editor-font-size, 12px)',
                                    }}>{item.comparison}</span>
                                  </div>
                                  {(showActualDetails || showFailureDetails) && (
                                    <>
                                      <span style={{ opacity: 0.7, fontSize: 12, paddingLeft: 24 }}>got: {typeof item.actual === 'object' ? JSON.stringify(item.actual) : String(item.actual)}</span>
                                      {typeof item.similarity === 'number' && (
                                        <span style={{ opacity: 0.7, fontSize: 12, paddingLeft: 24 }}>similarity: {item.similarity}%</span>
                                      )}
                                      {typeof item.count === 'number' && (
                                        <span style={{ opacity: 0.7, fontSize: 12, paddingLeft: 24 }}>count: {item.count}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          </div>
                        )}
                        {callDetails ? (
                          <StructuredDetails callDetails={callDetails} />
                        ) : (
                          report.details && report.details.trim().length > 0 && (
                            <pre
                              className="report-selectable"
                              style={{
                                margin: '6px 0 0 0',
                                opacity: 0.85,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                fontSize: 'var(--vscode-editor-font-size, 12px)',
                                cursor: 'text',
                              }}
                            >
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
