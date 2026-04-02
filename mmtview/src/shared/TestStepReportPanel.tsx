import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StepStatus } from './types';
import { statusIconFor } from './Common';

/** Parsed call result details extracted from the `_` field of an API call output. */
interface CallResultDetails {
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    query?: Record<string, string>;
  };
  response?: {
    body?: string;
    headers?: Record<string, string>;
    status?: number;
    statusText?: string;
    duration?: number;
  };
  outputs?: Record<string, any>;
  statusCode?: number;
}
/** Format a body string (try JSON pretty-print, then XML indent). */
function tryFormatBody(body: string | undefined): string {
  if (!body) { return ''; }
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // pass
  }
  if (isXml(body)) {
    return formatXml(body);
  }
  return body;
}

/** Check whether a string looks like XML. */
function isXml(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>');
}

/** Simple XML indenter for display purposes. */
function formatXml(xml: string): string {
  let formatted = '';
  let indent = 0;
  const parts = xml.replace(/(>)(<)/g, '$1\n$2').split('\n');
  for (const raw of parts) {
    const node = raw.trim();
    if (!node) { continue; }
    if (node.startsWith('</')) {
      indent = Math.max(indent - 1, 0);
    }
    formatted += '  '.repeat(indent) + node + '\n';
    if (node.startsWith('<') && !node.startsWith('</') && !node.startsWith('<?') && !node.endsWith('/>') && !node.includes('</')) {
      indent++;
    }
  }
  return formatted.trimEnd();
}

/** Unescape common escape sequences for display. */
function unescapeForDisplay(s: string): string {
  if (!s) { return s; }
  return s.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

/** Render headers as a compact key: value list. */
const HeadersBlock: React.FC<{ label: string; headers?: Record<string, string> }> = ({ label, headers }) => {
  if (!headers || Object.keys(headers).length === 0) { return null; }
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>{label}</span>
      <div style={{
        marginTop: 2, padding: '4px 6px', borderRadius: 4,
        background: 'var(--vscode-editor-background, #1e1e1e)',
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        fontSize: 'var(--vscode-editor-font-size, 12px)',
        maxHeight: 200, overflow: 'auto',
      }}>
        {Object.entries(headers).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 4 }}>
            <span style={{ opacity: 0.7 }}>{k}:</span>
            <span style={{ wordBreak: 'break-all' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** A pre block with optional "Format" button for body content. */
const BodyBlock: React.FC<{ label: string; body?: string }> = ({ label, body }) => {
  const [formatted, setFormatted] = useState(false);
  if (!body) { return null; }
  const displayBody = formatted ? tryFormatBody(body) : body;
  const canFormat = (() => {
    try { JSON.parse(body); return true; } catch { /* not JSON */ }
    if (isXml(body)) { return true; }
    return false;
  })();
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>{label}</span>
        {canFormat && (
          <button
            type="button"
            className="action-button"
            onClick={() => setFormatted(f => !f)}
            title={formatted ? 'Show raw' : 'Format JSON'}
            style={{ padding: '1px 5px', fontSize: 10, border: '1px solid var(--vscode-editorWidget-border, #555)', borderRadius: 3, background: 'transparent', cursor: 'pointer' }}
          >
            {formatted ? 'Raw' : 'Format'}
          </button>
        )}
      </div>
      <pre style={{
        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        fontSize: 'var(--vscode-editor-font-size, 12px)',
        maxHeight: 300, overflow: 'auto',
        padding: '4px 6px',
        borderRadius: 4,
        background: 'var(--vscode-editor-background, #1e1e1e)',
      }}>
        {unescapeForDisplay(displayBody)}
      </pre>
    </div>
  );
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
    if (underscore.status !== undefined) {
      result.statusCode = underscore.status;
    }
    if (typeof underscore.details === 'string') {
      try {
        const inner = JSON.parse(underscore.details);
        if (inner && typeof inner === 'object') {
          if (inner.request) { result.request = inner.request; }
          if (inner.response) { result.response = inner.response; }
        }
      } catch { /* ignore nested parse failure */ }
    }
    const outputs: Record<string, any> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k !== '_') {
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

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      {callDetails.request?.query && Object.keys(callDetails.request.query).length > 0 && (() => {
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
                  <span style={{ wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Outputs */}
      {callDetails.outputs && Object.keys(callDetails.outputs).length > 0 && (() => {
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
                  <span style={{ wordBreak: 'break-all' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</span>
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
              <BodyBlock label="Body" body={callDetails.request.body} />
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
              <BodyBlock label="Body" body={callDetails.response.body} />
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
}

export interface StepReportItem {
  stepIndex: number;
  stepType: 'check' | 'assert';
  status: StepStatus;
  title?: string;
  details?: string;
  expects: ExpectReportItem[];
  timestamp: number;
}

interface TestStepReportPanelProps {
  isExpanded: boolean;
  onToggleExpanded?: (next: boolean) => void;
  stepReports: StepReportItem[];
  runState: 'default' | 'running' | 'passed' | 'failed';
  onRun?: () => void;
  runButtonLabel?: string;
  disabledRun?: boolean;
  showHeader?: boolean;
}

const TestStepReportPanel: React.FC<TestStepReportPanelProps> = (props) => {
  const { isExpanded, stepReports, runState, onRun, runButtonLabel, disabledRun, showHeader = true } = props;
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const stepCountRef = useRef(0);

  useEffect(() => {
    stepCountRef.current = stepReports.length;
  }, [stepReports.length]);

  useEffect(() => {
    if (!isExpanded) {
      setExpandedDetails({});
    }
  }, [isExpanded]);

  const summary = useMemo(() => {
    if (runState === 'running') {
      return 'Running checks...';
    }
    if (runState === 'passed') {
      return 'All checks passed';
    }
    if (runState === 'failed') {
      return 'Run failed';
    }
    return 'Ready to run';
  }, [runState]);

  const unescapeCommon = useCallback((s: string): string => {
    if (!s) {
      return s;
    }
    return s.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }, []);



  if (!isExpanded) {
    return null;
  }

  return (
    <div style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 8 }}>
      {showHeader && (
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            backgroundColor: 'transparent',
          }}
        >
        </div>
      )}

      <div
        style={{
          minHeight: 160,
          border: '1px solid var(--vscode-editorWidget-border, #2a2a2a)',
          borderRadius: 6,
          padding: 12,
          background: 'transparent',
        }}
      >
        {stepReports.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            {runState === 'running' ? 'Waiting for checks and asserts to report…' : 'No check/assert results yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stepReports.map((report) => {
              const meta = statusIconFor(report.status);
              const reportKey = `${report.stepType}-${report.stepIndex}-${report.timestamp}`;
              const callDetails = parseCallDetails(report.details);
              const hasExpects = report.expects.length > 0;
              const hasDetails = Boolean(
                hasExpects ||
                callDetails ||
                (report.details && report.details.trim().length > 0)
              );
              const isDetailsExpanded = Boolean(expandedDetails[reportKey]);
              return (
                <div
                  key={reportKey}
                  style={{
                    border: '1px solid var(--vscode-editorWidget-border, #2a2a2a)',
                    backgroundColor: 'transparent',
                    borderRadius: 6,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <span
                    className={`codicon ${meta.icon}`}
                    style={{ color: meta.color, marginTop: 2 }}
                    aria-label={meta.title}
                  ></span>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{report.title || (report.stepType === 'check' ? 'Check' : 'Assert')}</span>
                      {hasDetails && (
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => setExpandedDetails((prev) => ({ ...prev, [reportKey]: !isDetailsExpanded }))}
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          title={isDetailsExpanded ? 'Hide details' : 'Show details'}
                        >
                          <span className={`codicon ${isDetailsExpanded ? 'codicon-circle-filled' : 'codicon-circle-outline'}`} />
                        </button>
                      )}
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{new Date(report.timestamp).toLocaleTimeString()}</span>
                    </div>

                    {isDetailsExpanded && (
                      <div style={{ marginTop: 4 }}>
                        {hasExpects && (
                          <div>
                            <SectionTitle label={report.expects.length === 1 ? 'Expect' : 'Expects'} />
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {report.expects.map((item, idx) => {
                              const itemMeta = statusIconFor(item.status);
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
                                  {item.status === 'failed' && item.actual !== undefined && item.expected !== undefined && (
                                    <span style={{ opacity: 0.7, fontSize: 12, paddingLeft: 24 }}>got: {typeof item.actual === 'object' ? JSON.stringify(item.actual) : String(item.actual)}</span>
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
                              style={{
                                margin: '6px 0 0 0',
                                opacity: 0.85,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                fontSize: 'var(--vscode-editor-font-size, 12px)',
                              }}
                            >
                              {unescapeCommon(String(report.details))}
                            </pre>
                          )
                        )}
                      </div>
                    )}
                  </div>


                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestStepReportPanel;
