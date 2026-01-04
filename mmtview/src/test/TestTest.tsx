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
    message?: string;
    left?: any;
    right?: any;
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
                    message: typeof message.message === 'string' ? message.message : undefined,
                    left: message.left,
                    right: message.right,
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
                    type="button"
                    onClick={handleRun}
                    disabled={runState === 'running'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 12px',
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
                            return (
                                <div
                                    key={`${report.stepType}-${report.stepIndex}-${report.timestamp}`}
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
                                            {report.stepIndex} {report.stepType === "check" ? "Check" : "Assert"} {meta.label}
                                        </div>
                                        <div>
                                            {report.comparison}
                                        </div>
                                        {report.left !== undefined && report.right !== undefined && (
                                            <div style={{ marginTop: 4, opacity: 0.8 }}>
                                                Left: {String(report.left)}, Right: {String(report.right)}
                                            </div>
                                        )}
                                        {report.message && (
                                            <div style={{ marginTop: 4, opacity: 0.8 }}>{report.message}</div>
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