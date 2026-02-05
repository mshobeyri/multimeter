import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StepStatus } from './types';
import { statusIconFor } from './Common';
export interface StepReportItem {
  stepIndex: number;
  stepType: 'check' | 'assert';
  status: StepStatus;
  comparison: string;
  title?: string;
  details?: string;
  actual?: any;
  expected?: any;
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

  const toDisplayText = useCallback((value: unknown): string => {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
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
              const hasDetails = Boolean(
                (report.details && report.details.trim().length > 0) ||
                (report.actual !== undefined && report.expected !== undefined)
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
                  <div style={{ flex: 1 }}>
                    <div style={{ marginTop: 2 }}>
                      {report.stepIndex} {report.stepType === 'check' ? 'Check' : 'Assert'}
                      {report.title ? `: ${report.title}` : ''}
                    </div>

                    {isDetailsExpanded && (
                      <div style={{ marginTop: 4 }}>
                        <div>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontFamily: 'var(--vscode-editor-font-family, monospace)',
                              fontSize: 'var(--vscode-editor-font-size, 12px)',
                            }}
                          >
                            {unescapeCommon(toDisplayText(report.comparison))}
                          </pre>
                        </div>
                        {report.actual !== undefined && report.expected !== undefined && (
                          <div style={{ opacity: 0.85, marginTop: 6 }}>
                            Left: {String(report.actual)}, Right: {String(report.expected)}
                          </div>
                        )}
                        {report.details && report.details.trim().length > 0 && (
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
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <div style={{ opacity: 0.7, textAlign: 'right' }}>{new Date(report.timestamp).toLocaleTimeString()}</div>
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
