import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestData } from 'mmt-core/TestData';
import { JSONRecord, formatDuration } from 'mmt-core/CommonData';
import { formatReportRelativeTime } from 'mmt-core/reportFormat';
import { resolveEnvTokenValues } from 'mmt-core/variableReplacer';
import { extractInputConstraintsFromDescription } from 'mmt-core/paramConstraints';
import { testToYaml } from 'mmt-core/testParsePack';

import { FileContext } from '../fileContext';
import { setEnvironmentVariable } from '../environment/environmentUtils';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import { StepStatus } from '../shared/types';
import ExportReportButton, { ReportFormat } from '../shared/ExportReportButton';
import OverviewBoxes, { OverviewStats } from '../shared/OverviewBoxes';
import VEditor from '../components/VEditor';
import ContextMenuHost, { runInCoreMenuItem } from '../components/ContextMenuHost';
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
    const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
    const [runDurationMs, setRunDurationMs] = useState<number | null>(null);
    const testDataRef = useRef(props.testData);
    testDataRef.current = props.testData;

    /** Right-panel runs always prefer UI test data; glyphs omit rawFile. */
    const postRunCurrentDocument = useCallback((opts?: { reportLifecycle?: boolean }) => {
        window.vscode?.postMessage({
            command: 'runCurrentDocument',
            ...(opts?.reportLifecycle ? { report: { type: 'lifecycle' } } : {}),
            rawFile: testToYaml(testDataRef.current),
            inputs: {
                manualInputs: currentInputsRef.current,
            },
        });
    }, []);

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

    const inputConstraints = useMemo(
        () => extractInputConstraintsFromDescription(props.testData.description || ''),
        [props.testData.description]
    );

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
        const startedAt = Date.now();
        runStartTimeRef.current = startedAt;
        setRunStartedAt(startedAt);
        setRunDurationMs(null);
        postRunCurrentDocument();
    }, [trimIgnoredRuns, postRunCurrentDocument]);

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
                    stepType: message.stepType === 'assert' ? 'assert' : message.stepType === 'debug' ? 'debug' : 'check',
                    status: message.status === 'failed' ? 'failed' : 'passed',
                    title: typeof (message as any).title === 'string' ? (message as any).title : undefined,
                    details: typeof (message as any).details === 'string' ? (message as any).details : undefined,
                    expects: Array.isArray((message as any).expects) ? (message as any).expects : [],
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
                startedAt: runStartedAt,
                testTitle: props.testData.title,
            },
        });
    }, [stepReports, runState, outputs, mmtFilePath, runStartedAt, runDurationMs, props.testData.title]);

    const exportDisabled = runState === 'running' || stepReports.length === 0;

    const isRunning = runState === 'running';

    const overviewStats = useMemo((): OverviewStats | null => {
        if (stepReports.length === 0 && runState === 'default') {
            return null;
        }
        const passed = stepReports.filter(r => r.status === 'passed').length;
        const failed = stepReports.filter(r => r.status === 'failed').length;
        const total = stepReports.length;
        const duration = runDurationMs != null ? formatDuration(runDurationMs) : undefined;
        const date = runStartedAt != null ? formatReportRelativeTime(runStartedAt) : undefined;
        return {
            passed,
            failed,
            total,
            duration,
            totalSub: `${total} check${total !== 1 ? 's' : ''}`,
            durationSub: date,
        };
    }, [stepReports, runState, runStartedAt, runDurationMs]);

    return (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className="run-action-bar">
                {isRunning ? (
                    <button
                        onClick={handleStop}
                        className="button-icon"
                        type="button"
                    >
                        <span className="codicon codicon-debug-stop" aria-hidden />
                        Stop
                    </button>
                ) : (
                    <ContextMenuHost items={[runInCoreMenuItem(() => {
                        postRunCurrentDocument({ reportLifecycle: true });
                    })]}>
                        <button
                            onClick={handleRun}
                            className="button-icon"
                            type="button"
                        >
                            <span className="codicon codicon-run" aria-hidden />
                            Run test
                        </button>
                    </ContextMenuHost>
                )}
                <ExportReportButton disabled={exportDisabled} onExport={handleExportReport} />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
                        inputConstraints={inputConstraints}
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
        </div>
    );
};

export default TestTest;