import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { StepStatus, SuiteEntry, SuiteGroup } from '../types';
import { SuiteTestTree } from './';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { useSuiteImportTree } from './useSuiteImportTree';
import { SuiteTreeNode } from './suiteHierarchy';
import { getSuiteHierarchy } from '../../vsAPI';
import { childSuiteLeafPrefix } from './leafIdHelpers';
import { resetLeafStateMap } from './leafStateReset';

interface SuiteTestProps {
    content: string;
}

let suiteEntrySuffix = 0;
const nextSuiteEntryId = () => `suite-entry-test-${suiteEntrySuffix++}`;

const buildSuiteGroupsFromContent = (content: string): SuiteGroup[] => {
    const parsed = parseYaml(content);
    const tests: any[] = Array.isArray(parsed?.tests) ? parsed.tests : [];
    const rawGroups: SuiteEntry[][] = [];
    let currentEntries: SuiteEntry[] = [];

    const pushGroup = () => {
        if (currentEntries.length) {
            rawGroups.push(currentEntries);
            currentEntries = [];
        }
    };

    for (const raw of tests) {
        if (typeof raw !== 'string') {
            continue;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            continue;
        }
        if (trimmed === 'then') {
            pushGroup();
            continue;
        }
        currentEntries.push({ id: nextSuiteEntryId(), path: trimmed });
    }
    pushGroup();

    if (!rawGroups.length) {
        return [];
    }

    const singleGroup = rawGroups.length === 1;

    return rawGroups.map((entries, groupIndex) => {
        const entriesWithLeaf = entries.map((entry, entryIndex) => {
            const leafId = singleGroup ? `root/${entryIndex}` : `root/g${groupIndex}/${entryIndex}`;
            return { ...entry, leafId };
        });
        return { label: `Group ${groupIndex + 1}`, entries: entriesWithLeaf };
    });
};

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
    const allPaths: string[] = [];
    groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
    return allPaths;
};

const statusIconFor = (status: StepStatus | 'running' | 'cancelled') => {
    if (status === 'running') {
        return { icon: 'codicon-play-circle', color: '#BA8E23', title: 'Running' };
    }
    if (status === 'cancelled') {
        return { icon: 'codicon-stop-circle', color: ' #f88349', title: 'Cancelled' };
    }
    if (status === 'passed') {
        return { icon: 'codicon-pass', color: '#23d18b', title: 'Passed' };
    }
    if (status === 'failed') {
        return { icon: 'codicon-error', color: '#f85149', title: 'Failed' };
    }
    if (status === 'pending') {
        return { icon: 'codicon-compass', color: '#3794ff', title: 'Pending' };
    }
    return { icon: 'codicon-circle-large', color: '#c5c5c5', title: 'Default' };
};

const SuiteTest: React.FC<SuiteTestProps> = ({ content }) => {
    const groups = useMemo(() => buildSuiteGroupsFromContent(content), [content]);
    const allPaths = useMemo(() => collectSuitePaths(groups), [groups]);
    const canRun = allPaths.length > 0;
    const noItems = groups.every(group => group.entries.length === 0);

    useSuiteImportTree(allPaths, true);

    const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus | 'running'>>({});
    const [lastRunIdByEntryId, setLastRunIdByEntryId] = useState<Record<string, string>>({});
    const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

    const [suiteRunId, setSuiteRunId] = useState<string | null>(null);
    const [suiteRunState, setSuiteRunState] = useState<'idle' | 'running' | 'cancelled'>('idle');
    const [leafReportsByLeafId, setLeafReportsByLeafId] = useState<Record<string, StepReportItem[]>>({});
    const [leafRunStateByLeafId, setLeafRunStateByLeafId] = useState<Record<string, 'idle' | 'running' | 'passed' | 'failed' | 'cancelled'>>({});
    const pendingLeafResetRef = useRef<'all' | string[] | null>(null);

    const resetLeafState = useCallback((mode: 'all' | readonly string[]) => {
        if (mode === 'all') {
            setLeafReportsByLeafId({});
            setLeafRunStateByLeafId({});
            return;
        }
        if (!Array.isArray(mode) || mode.length === 0) {
            return;
        }
        setLeafReportsByLeafId(prev => resetLeafStateMap(prev, mode));
        setLeafRunStateByLeafId(prev => resetLeafStateMap(prev, mode));
    }, [setLeafReportsByLeafId, setLeafRunStateByLeafId]);

    const [hierarchyByEntryPath, setHierarchyByEntryPath] = useState<Record<string, SuiteTreeNode[]>>({});

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const result: Record<string, SuiteTreeNode[]> = {};
            for (const group of groups) {
                for (const entry of group.entries) {
                    try {
                        const res = await getSuiteHierarchy(entry.path, childSuiteLeafPrefix(entry.leafId));
                        const tree = (res as any)?.tree as any[] | undefined;
                        if (Array.isArray(tree)) {
                            result[entry.path] = tree as any;
                        }
                    } catch {
                        // Ignore; tree will treat it as non-suite.
                    }
                }
            }
            if (!cancelled) {
                setHierarchyByEntryPath(result);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [groups]);

    useEffect(() => {
        setStepStatuses({});
        setSuiteRunId(null);
        setSuiteRunState('idle');
        pendingLeafResetRef.current = null;
        resetLeafState('all');
    }, [content, resetLeafState]);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (!message || typeof message !== 'object') {
                return;
            }

            if (message.command === 'suiteRunStart') {
                const nextSuiteRunId = typeof message.suiteRunId === 'string' ? message.suiteRunId : null;
                if (!nextSuiteRunId) {
                    return;
                }
                setSuiteRunId(nextSuiteRunId);
                setSuiteRunState('running');
                const hint = pendingLeafResetRef.current;
                pendingLeafResetRef.current = null;
                if (hint === 'all') {
                    resetLeafState('all');
                } else if (Array.isArray(hint) && hint.length) {
                    resetLeafState(hint);
                } else {
                    resetLeafState('all');
                }
                return;
            }

            if (message.command === 'suiteRunEnd') {
                const endedId = typeof message.suiteRunId === 'string' ? message.suiteRunId : null;
                if (endedId && suiteRunId && endedId !== suiteRunId) {
                    return;
                }
                const cancelled = Boolean((message as any).cancelled);
                setSuiteRunState(cancelled ? 'cancelled' : 'idle');
                return;
            }

            if (message.command === 'suiteRunStopped') {
                const stoppedId = typeof message.suiteRunId === 'string' ? message.suiteRunId : null;
                if (stoppedId && suiteRunId && stoppedId !== suiteRunId) {
                    return;
                }
                setSuiteRunState('cancelled');

                // Mark currently running leaves as cancelled
                setLeafRunStateByLeafId((prev) => {
                    const next: typeof prev = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (next[k] === 'running') {
                            next[k] = 'cancelled';
                        }
                    });
                    return next;
                });
                return;
            }

            if (message.command === 'runFileReport') {
                console.log('Received runFileReport message in SuiteTest:', message);
                const incomingSuiteRunId = typeof (message as any).suiteRunId === 'string' ? (message as any).suiteRunId : null;
                if (suiteRunId && incomingSuiteRunId && incomingSuiteRunId !== suiteRunId) {
                    return;
                }

                const runId = typeof (message as any).runId === 'string' ? (message as any).runId : null;
                const { groupIndex, groupItemIndex, success, status } = message as any;
                const nextStatus: StepStatus | 'running' = status || (success ? 'passed' : 'failed');

                if (runId && typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
                    const group = groups[groupIndex];
                    const entry = group?.entries?.[groupItemIndex];
                    if (entry?.id) {
                        setLastRunIdByEntryId(prev => ({ ...prev, [entry.id]: runId }));
                    }
                }

                if (runId) {
                    setStepStatuses(prev => ({ ...prev, [runId]: nextStatus }));
                }

                // Leaf report routing for suite runs.
                const leafId = typeof (message as any).leafId === 'string' ? (message as any).leafId : null;
                const scope = typeof (message as any).scope === 'string' ? (message as any).scope : '';
                if (leafId) {
                    if (scope === 'suite-item' && nextStatus === 'running') {
                        setLeafRunStateByLeafId(prev => ({ ...prev, [leafId]: 'running' }));
                    }
                    if (scope === 'suite-item' && (nextStatus === 'passed' || nextStatus === 'failed')) {
                        setLeafRunStateByLeafId(prev => ({ ...prev, [leafId]: nextStatus }));
                    }

                    if (scope === 'test-step') {
                        const normalized: StepReportItem = {
                            stepIndex: Number((message as any).stepIndex) || 1,
                            stepType: (message as any).stepType === 'assert' ? 'assert' : 'check',
                            status: (message as any).status === 'failed' ? 'failed' : 'passed',
                            comparison: typeof (message as any).comparison === 'string' ? (message as any).comparison : '',
                            title: typeof (message as any).title === 'string' ? (message as any).title : undefined,
                            details: typeof (message as any).details === 'string' ? (message as any).details : undefined,
                            actual: (message as any).actual,
                            expected: (message as any).expected,
                            timestamp: typeof (message as any).timestamp === 'number' ? (message as any).timestamp : Date.now(),
                        };
                        setLeafReportsByLeafId(prev => ({
                            ...prev,
                            [leafId]: [...(prev[leafId] || []), normalized],
                        }));
                        if (normalized.status === 'failed') {
                            setLeafRunStateByLeafId(prev => ({ ...prev, [leafId]: 'failed' }));
                        }
                    }

                    // Ensure final run summaries win: a failed summary must mark the leaf failed.
                    // This prevents "passed" states when a failing check was reported.
                    if (scope === 'test-step-run' && success === false) {
                        setLeafRunStateByLeafId(prev => ({ ...prev, [leafId]: 'failed' }));
                    }
                }

                if (runId) {
                    return;
                }

                if (typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
                    const group = groups[groupIndex];
                    if (group) {
                        const entry = group.entries[groupItemIndex];
                        if (entry) {
                            setStepStatuses(prev => ({ ...prev, [entry.id]: nextStatus }));
                        }
                    }
                }
                return;
            }
            if (message.command === 'validateFilesExistResult') {
                setMissingFiles(new Set(message.missing || []));
                return;
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [groups, suiteRunId, resetLeafState]);

    useEffect(() => {
        if (allPaths.length > 0) {
            window.vscode?.postMessage({ command: 'validateFilesExist', files: allPaths });
        } else {
            setMissingFiles(new Set());
        }
    }, [allPaths]);

    const onRunSuite = useCallback(() => {
        const next: Record<string, StepStatus | 'running'> = {};
        groups.forEach((group) => group.entries.forEach((entry) => (next[entry.id] = 'pending')));
        setStepStatuses(next);
        const nextSuiteRunId = `suite-ui:${Date.now()}`;
        setSuiteRunId(nextSuiteRunId);
        setSuiteRunState('running');
        pendingLeafResetRef.current = 'all';
        resetLeafState('all');
        window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId });
    }, [groups, resetLeafState]);

    const onRunTargets = useCallback((targets: string[]) => {
        const unique = Array.from(new Set((targets || []).filter(Boolean)));
        if (!unique.length) {
            return;
        }

        // For leafId-based (bundle) runs we can't pre-mark by gi/ei.
        setStepStatuses((prev) => ({ ...prev }));

        pendingLeafResetRef.current = unique;
        resetLeafState(unique);

        const nextSuiteRunId = `suite-ui:${Date.now()}`;
        setSuiteRunId(nextSuiteRunId);
        setSuiteRunState('running');
        window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId, targets: unique });
    }, [resetLeafState]);

    const onStopSuite = useCallback(() => {
        if (!suiteRunId) {
            return;
        }
        window.vscode?.postMessage({ command: 'stopSuiteRun', suiteRunId });
    }, [suiteRunId]);

    const tree = (
        <SuiteTestTree
            groups={groups}
            hierarchyByEntryPath={hierarchyByEntryPath}
            missingFiles={missingFiles}
            stepStatuses={stepStatuses}
            lastRunIdByEntryId={lastRunIdByEntryId}
            statusIconFor={statusIconFor}
            leafReportsByLeafId={leafReportsByLeafId}
            leafRunStateByLeafId={leafRunStateByLeafId}
            onRunTargets={onRunTargets}
        />
    );

    return (
        <div className="panel-box">
            <div className="test-flow-tree" style={{ paddingTop: 4 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        alignItems: 'center',
                        position: 'relative',
                        gap: 8,
                    }}
                >
                    <div style={{ fontWeight: 700 }}>Suite Test</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="button-icon"
                            disabled={!canRun}
                            onClick={onRunSuite}
                            title={!canRun ? 'No suite files to run' : 'Run suite'}
                        >
                            <span className="codicon codicon-run" aria-hidden />
                            Run suite
                        </button>
                        <button
                            className="button-icon"
                            disabled={suiteRunState !== 'running'}
                            onClick={onStopSuite}
                            title={suiteRunState !== 'running' ? 'Suite is not running' : 'Stop suite'}
                        >
                            <span className="codicon codicon-debug-stop" aria-hidden />
                            Stop
                        </button>
                    </div>
                </div>
                {noItems ? <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div> : tree}
            </div>
        </div>
    );
};

export default SuiteTest;
