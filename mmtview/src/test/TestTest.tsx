import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TestData } from 'mmt-core/TestData';
import { JSONRecord } from 'mmt-core/CommonData';

import { FileContext } from '../fileContext';
import { setEnvironmentVariable } from '../environment/environmentUtils';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import { StepStatus } from '../shared/types';
import VEditor from '../components/VEditor';
import { loadEnvVariables } from '../workspaceStorage';

interface TestTestProps {
    testData: TestData;
    rightOfRunButton?: React.ReactNode;
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
                    let resolvedVal: string = val;
                    resolvedVal = resolvedVal.replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, (_m, name) => {
                        const envVal = envParameters[name];
                        return envVal !== undefined ? String(envVal) : _m;
                    });
                    resolvedVal = resolvedVal.replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, (_m, name) => {
                        const envVal = envParameters[name];
                        return envVal !== undefined ? String(envVal) : _m;
                    });
                    resolvedVal = resolvedVal.replace(/\be:\{([A-Za-z0-9_]+)\}/g, (_m, name) => {
                        const envVal = envParameters[name];
                        return envVal !== undefined ? String(envVal) : _m;
                    });
                    resolvedVal = resolvedVal.replace(/\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, (_m, name) => {
                        const envVal = envParameters[name];
                        return envVal !== undefined ? String(envVal) : _m;
                    });
                    resolved[key] = resolvedVal;
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
        window.vscode?.postMessage({
            command: 'runCurrentDocument',
            inputs: {
                manualInputs: currentInputsRef.current,
            },
        });
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    {props.rightOfRunButton}
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
            {(hasInputs || hasOutputs) && (
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