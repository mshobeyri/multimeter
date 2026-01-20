import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestData } from 'mmt-core/TestData';

import { FileContext } from '../fileContext';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import { StepStatus } from '../shared/types';

interface TestTestProps {
    testData: TestData;
}

const TestTest: React.FC<TestTestProps> = (_props) => {
    const { mmtFilePath } = useContext(FileContext);
    const [stepReports, setStepReports] = useState<StepReportItem[]>([]);
    const [runState, setRunState] = useState<StepStatus>('default');
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
            <TestStepReportPanel
                isExpanded={true}
                stepReports={stepReports}
                runState={runState === 'running' ? 'running' : runState === 'passed' ? 'passed' : runState === 'failed' ? 'failed' : 'default'}
                onRun={handleRun}
                runButtonLabel="Run test"
            />
        </div>
    );
};

export default TestTest;