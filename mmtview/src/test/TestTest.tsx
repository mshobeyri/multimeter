import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestData } from 'mmt-core/TestData';

import { FileContext } from '../fileContext';

interface TestTestProps {
    testData: TestData;
}

export type StepStatus = 'passed' | 'failed';

interface StepReportItem {
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

const STATUS_META: Record<StepStatus, { icon: string; color: string; label: string }> = {
    passed: { icon: 'codicon-pass', color: '#23d18b', label: 'Passed' },
    failed: { icon: 'codicon-error', color: '#f85149', label: 'Failed' },
};

const TestTest: React.FC<TestTestProps> = (_props) => {
    const { mmtFilePath } = useContext(FileContext);
    const [stepReports, setStepReports] = useState<StepReportItem[]>([]);
    const [runState, setRunState] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
    const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
    const latestRunIdRef = useRef<string | null>(null);
    const ignoredRunIdsRef = useRef<Set<string>>(new Set());
    const stepCountRef = useRef(0);

    useEffect(() => {
        stepCountRef.current = stepReports.length;
    }, [stepReports.length]);

    const trimIgnoredRuns = useCallback(() => {
        if (ignoredRunIdsRef.current.size <= 10) {
            return;
        }
        const first = ignoredRunIdsRef.current.values().next();
        if (!first.done) {
            ignoredRunIdsRef.current.delete(first.value);
        }
    }, []);

    const handleRun = useCallback(() => {
        if (latestRunIdRef.current) {
            ignoredRunIdsRef.current.add(latestRunIdRef.current);
            trimIgnoredRuns();
        }
        latestRunIdRef.current = null;
        setStepReports([]);
        setExpandedDetails({});
        setRunState('running');
        window.vscode?.postMessage({ command: 'runCurrentDocument' });
    }, [trimIgnoredRuns]);

    const appendReport = useCallback((report: StepReportItem) => {
        setStepReports(prev => [...prev, report]);
    }, []);

    const acceptRunEvent = useCallback((runId: string): boolean => {
        if (ignoredRunIdsRef.current.has(runId)) {
            return false;
        }
        const current = latestRunIdRef.current;
        if (!current || current !== runId) {
            latestRunIdRef.current = runId;
            setStepReports([]);
            setRunState('running');
        }
        return true;
    }, [setRunState, setStepReports]);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (!message || typeof message !== 'object') {
                return;
            }
            if (message.command !== 'runFileReport') {
                return;
            }
            if (message.filePath && mmtFilePath && message.filePath !== mmtFilePath) {
                return;
            }
            const scope = typeof message.scope === 'string' ? message.scope : undefined;
            if (scope !== 'test-step' && scope !== 'test-step-run' && scope !== 'test-finished') {
                return;
            }
            const runId = typeof message.runId === 'string' ? message.runId : null;
            if (runId && !acceptRunEvent(runId)) {
                return;
            }
            if (!runId && scope !== 'test-finished' && latestRunIdRef.current) {
                return;
            }

            if (scope === 'test-step') {
                const normalized: StepReportItem = {
                    stepIndex: Number(message.stepIndex) || stepCountRef.current + 1,
                    stepType: message.stepType === 'assert' ? 'assert' : 'check',
                    status: message.status === 'failed' ? 'failed' : 'passed',
                    comparison: typeof message.comparison === 'string' ? message.comparison : '',
                    title: typeof (message as any).title === 'string' ? (message as any).title : undefined,
                    details: typeof (message as any).details === 'string' ? (message as any).details : undefined,
                    actual: (message as any).actual,
                    expected: (message as any).expected,
                    timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now(),
                };
                appendReport(normalized);
                if (normalized.status === 'failed') {
                    setRunState('failed');
                }
                return;
            }

            if (scope === 'test-step-run') {
                setRunState(message.result === 'passed' ? 'passed' : 'failed');
                return;
            }

            if (scope === 'test-finished') {
                setRunState(message.success ? 'passed' : 'failed');
                return;
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [acceptRunEvent, appendReport, mmtFilePath]);

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

    return (
        <div style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <div
                style={{
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    backgroundColor: "transparent"
                }}>
                <div>{summary}</div>
                <button
                    onClick={handleRun}
                    className='button-icon'
                    disabled={runState === 'running'}
                    style={{
                        opacity: runState === 'running' ? 0.7 : 1,
                    }}
                >
                    <span className="codicon codicon-run" />
                    {runState === 'running' ? 'Running…' : 'Run test'}
                </button>
            </div>
            <div
                style={{
                    minHeight: 160,
                    border: '1px solid var(--vscode-editorWidget-border, #2a2a2a)',
                    borderRadius: 6,
                    padding: 12,
                    background: 'transparent',
                }}>
                {stepReports.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>
                        {runState === 'running'
                            ? 'Waiting for checks and asserts to report…'
                            : 'Run the test to see check/assert results.'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stepReports.map(report => {
                            const meta = STATUS_META[report.status];
                            const reportKey = `${report.stepType}-${report.stepIndex}-${report.timestamp}`;
                            const hasDetails = Boolean(
                                (report.details && report.details.trim().length > 0) ||
                                (report.actual !== undefined && report.expected !== undefined)
                            );
                            const isExpanded = Boolean(expandedDetails[reportKey]);
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
                                        aria-label={meta.label}
                                    ></span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ marginBottom: 2 }}>
                                            {report.stepIndex} {report.stepType === 'check' ? 'Check' : 'Assert'}
                                            {report.title ? `: ${report.title}` : ''}
                                        </div>
                                        <div>
                                            {report.comparison}
                                        </div>
                                        {hasDetails && (
                                            <div style={{ marginTop: 6 }}>
                                                {!isExpanded ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedDetails(prev => ({ ...prev, [reportKey]: true }))}
                                                        style={{
                                                            padding: 0,
                                                            border: 'none',
                                                            background: 'transparent',
                                                            opacity: 0.7,
                                                            textDecoration: 'underline',
                                                            cursor: 'pointer',
                                                            font: 'inherit',
                                                        }}
                                                    >
                                                        show details
                                                    </button>
                                                ) : (
                                                    <div style={{ marginTop: 4 }}>
                                                        {report.actual !== undefined && report.expected !== undefined && (
                                                            <div style={{ opacity: 0.85 }}>
                                                                Actual: {String(report.actual)}, Expected: {String(report.expected)}
                                                            </div>
                                                        )}
                                                        {report.details && report.details.trim().length > 0 && (
                                                            <div style={{ marginTop: 4, opacity: 0.85 }}>{report.details}</div>
                                                        )}
                                                        <div style={{ marginTop: 6 }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedDetails(prev => ({ ...prev, [reportKey]: false }))}
                                                                style={{
                                                                    padding: 0,
                                                                    border: 'none',
                                                                    background: 'transparent',
                                                                    opacity: 0.7,
                                                                    textDecoration: 'underline',
                                                                    cursor: 'pointer',
                                                                    font: 'inherit',
                                                                }}
                                                            >
                                                                hide details
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ opacity: 0.7, textAlign: 'right' }}>
                                        {new Date(report.timestamp).toLocaleTimeString()}
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

export default TestTest;