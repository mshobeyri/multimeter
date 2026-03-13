import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestData } from 'mmt-core/TestData';
import { JSONRecord, formatDuration } from 'mmt-core/CommonData';
import { resolveEnvTokenValues } from 'mmt-core/variableReplacer';

import { FileContext } from '../fileContext';
import { setEnvironmentVariable } from '../environment/environmentUtils';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import { StepStatus } from '../shared/types';
import ExportReportButton, { ReportFormat } from '../shared/ExportReportButton';
import OverviewBoxes, { OverviewStats } from '../shared/OverviewBoxes';
import VEditor from '../components/VEditor';
import { loadEnvVariables } from '../workspaceStorage';

interface TestTestProps {
    testData: TestData;
}

const TestTest: React.FC<TestTestProps> = (props) => {
    const { mmtFilePath } = useContext(FileContext);
    const [stepReports, setStepReports] = useState<StepReportItem[]>([]);
    const [runState, setRunState] = useState<StepStatus>('default');
    const latestRunIdRef = useRef<string | null>(null);
    const ignoredRunIdsRef = useRef<Set<string>>(new Set());
    const stepCountRef = useRef(0);

    // Inputs/outputs state
    const [currentInputs, setCurrentInputs] = useState<JSONRecord>({});
    const currentInputsRef = useRef<JSONRecord>({});
    const [outputs, setOutputs] = useState<JSONRecord>({});
    const runStartTimeRef = useRef<number | null>(null);
    const [runDurationMs, setRunDurationMs] = useState<number | null>(null);

    const inputKeys = useMemo(() => {
        const raw = props.testData.inputs;
        if (!raw || typeof raw !== 'object') {
            return [];
        }
        return Object.keys(raw);
    }, [props.testData.inputs]);

    const outputKeys = useMemo(() => {
        const raw = props.testData.outputs;
        if (!raw || typeof raw !== 'object') {
            return [];
        }
        return Object.keys(raw);
    }, [props.testData.outputs]);

    const hasInputs = inputKeys.length > 0;
    const hasOutputs = outputKeys.length > 0;

    // Resolve env variables in default input values
    useEffect(() => {
        const defaults: JSONRecord = { ...(props.testData.inputs || {}) };
        const resolveDefaults = (envVars: any[]) => {
            const envParameters: JSONRecord = (envVars || []).reduce((acc: JSONRecord, envVar: any) => {
                if (envVar && typeof envVar === 'object' && typeof envVar.name === 'string') {
                    acc[envVar.name] = envVar.value;
                }
                return acc;
            }, {} as JSONRecord);
            // Resolve e:xxx references in default values
            const resolved: JSONRecord = {};
            for (const [key, val] of Object.entries(defaults)) {
                if (typeof val === 'string') {
                    resolved[key] = resolveEnvTokenValues(val, envParameters);
                } else {
                    resolved[key] = val;
                }
            }
            setCurrentInputs(resolved);
            currentInputsRef.current = resolved;
        };

        const cleanup = loadEnvVariables(resolveDefaults);
        return cleanup;
    }, [props.testData.inputs]);

    useEffect(() => {
        currentInputsRef.current = currentInputs;
    }, [currentInputs]);

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
        setOutputs({});
        setRunState('running');
        runStartTimeRef.current = Date.now();
        setRunDurationMs(null);
        window.vscode?.postMessage({
            command: 'runCurrentDocument',
            inputs: {
                manualInputs: currentInputsRef.current,
            },
        });
    }, [trimIgnoredRuns]);

    const handleStop = useCallback(() => {
        window.vscode?.postMessage({
            command: 'stopTestRun',
        });
    }, []);

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
            if (scope !== 'test-step' && scope !== 'test-step-run' && scope !== 'test-finished' && scope !== 'setenv' && scope !== 'test-outputs') {
                return;
            }
            const runId = typeof message.runId === 'string' ? message.runId : null;
            if (runId && !acceptRunEvent(runId)) {
                return;
            }
            if (!runId && scope !== 'test-finished' && scope !== 'setenv' && scope !== 'test-outputs' && latestRunIdRef.current) {
                return;
            }

            if (scope === 'setenv') {
                const name = typeof message.name === 'string' ? message.name : '';
                const value = message.value;
                const testTitle = typeof (message as any).testTitle === 'string' ? (message as any).testTitle : undefined;
                const label = testTitle ? `test - ${testTitle}` : 'test';
                if (name) {
                    setEnvironmentVariable(name, value, label);
                }
                return;
            }

            if (scope === 'test-outputs') {
                const receivedOutputs = message.outputs;
                if (receivedOutputs && typeof receivedOutputs === 'object') {
                    setOutputs(receivedOutputs);
                }
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
                // Update running duration on every step so it's never stale
                if (runStartTimeRef.current) {
                    setRunDurationMs(Date.now() - runStartTimeRef.current);
                }
                return;
            }

            if (scope === 'test-step-run') {
                setRunState(message.result === 'passed' ? 'passed' : 'failed');
                if (runStartTimeRef.current) {
                    setRunDurationMs(Date.now() - runStartTimeRef.current);
                    runStartTimeRef.current = null;
                }
                return;
            }

            if (scope === 'test-finished') {
                setRunState(message.success ? 'passed' : 'failed');
                if (runStartTimeRef.current) {
                    setRunDurationMs(Date.now() - runStartTimeRef.current);
                    runStartTimeRef.current = null;
                }
                return;
            }
        };

        const stopHandler = (event: MessageEvent) => {
            const message = event.data;
            if (!message || typeof message !== 'object') {
                return;
            }
            if (message.command === 'testRunStopped') {
                if (runStartTimeRef.current) {
                    setRunDurationMs(Date.now() - runStartTimeRef.current);
                    runStartTimeRef.current = null;
                }
                setRunState('default');
            }
        };

        window.addEventListener('message', handler);
        window.addEventListener('message', stopHandler);
        return () => {
            window.removeEventListener('message', handler);
            window.removeEventListener('message', stopHandler);
        };
    }, [acceptRunEvent, appendReport, mmtFilePath]);

    const handleExportReport = useCallback((format: ReportFormat) => {
        window.vscode?.postMessage({
            command: 'exportReport',
            format,
            data: {
                type: 'test',
                stepReports,
                runState,
                outputs,
                filePath: mmtFilePath,
                durationMs: runDurationMs,
                testTitle: props.testData.title,
            },
        });
    }, [stepReports, runState, outputs, mmtFilePath, runDurationMs, props.testData.title]);

    const exportDisabled = runState === 'running' || stepReports.length === 0;

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

    const isRunning = runState === 'running';

    const overviewStats = useMemo((): OverviewStats | null => {
        if (stepReports.length === 0 && runState === 'default') {
            return null;
        }
        const passed = stepReports.filter(r => r.status === 'passed').length;
        const failed = stepReports.filter(r => r.status === 'failed').length;
        const total = stepReports.length;
        const duration = runDurationMs != null ? formatDuration(runDurationMs) : undefined;
        return {
            passed,
            failed,
            total,
            duration,
            totalSub: `${total} check${total !== 1 ? 's' : ''}`,
        };
    }, [stepReports, runState, runDurationMs]);

    return (
        <div style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <div
                style={{
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isRunning ? (
                        <button
                            onClick={handleStop}
                            className='button-icon'
                            style={{ opacity: 1 }}
                        >
                            <span className="codicon codicon-debug-stop" />
                            Stop
                        </button>
                    ) : (
                        <button
                            onClick={handleRun}
                            className='button-icon'
                            style={{ opacity: 1 }}
                        >
                            <span className="codicon codicon-run" />
                            Run test
                        </button>
                    )}
                    <ExportReportButton disabled={exportDisabled} onExport={handleExportReport} />
                </div>
            </div>
            {hasInputs && (
                <div style={{ marginBottom: 12 }}>
                    <VEditor
                        label="Inputs"
                        value={currentInputs}
                        onChange={(data) => {
                            setCurrentInputs(data);
                            currentInputsRef.current = data;
                        }}
                        keyOptions={inputKeys}
                        deletable={false}
                    />
                </div>
            )}
            {hasOutputs && (
                <div style={{ marginBottom: 12 }}>
                    <VEditor
                        label="Outputs"
                        value={outputs}
                        onChange={() => {}}
                        keyOptions={outputKeys}
                        deletable={false}
                        copyable={true}
                    />
                </div>
            )}
            {overviewStats && <OverviewBoxes stats={overviewStats} />}
            {(hasInputs || hasOutputs || overviewStats) && (
                <div className="label" style={{ marginBottom: 10 }}>Report</div>
            )}
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