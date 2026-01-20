import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { splitSuiteGroups } from 'mmt-core/suiteParsePack';
import { createSuiteNodeId } from 'mmt-core/suiteNodeId';
import { StepStatus } from '../../shared/types';
import { SuiteEntry, SuiteGroup } from '../types';
import { SuiteTestTree } from './';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { useSuiteImportTree } from './useSuiteImportTree';
import { SuiteTreeNode } from './suiteHierarchy';
import { getSuiteHierarchy } from '../../vsAPI';
// Suite hierarchy prefixes removed; targeting is now bundle id.
import { resetLeafStateMap } from './leafStateReset';
import { statusIconFor } from '../../shared/Common';

interface SuiteTestProps {
    content: string;
}

const buildSuiteGroupsFromContent = (content: string): SuiteGroup[] => {
    const parsed = parseYaml(content);
    const tests: string[] = Array.isArray(parsed?.tests)
        ? parsed.tests.map((value: any) => (typeof value === 'string' ? value.trim() : '').trim()).filter(Boolean)
        : [];

    if (!tests.length) {
        return [];
    }

    let grouped: string[][] = [];
    try {
        grouped = splitSuiteGroups([...tests]);
    } catch {
        const fallbackGroups: string[][] = [];
        let current: string[] = [];
        const flush = () => {
            if (current.length) {
                fallbackGroups.push(current);
                current = [];
            }
        };
        tests.forEach((entry) => {
            if (entry === 'then') {
                flush();
                return;
            }
            current.push(entry);
        });
        flush();
        grouped = fallbackGroups;
    }

    if (!grouped.length) {
        return [];
    }

    return grouped.map((entries, groupIndex) => {
        const mappedEntries: SuiteEntry[] = entries.map((path, entryIndex) => {
            return {
                id: createSuiteNodeId([groupIndex, entryIndex]),
                path,
            };
        });
        return { label: `Group ${groupIndex + 1}`, entries: mappedEntries };
    });
};

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
    const allPaths: string[] = [];
    groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
    return allPaths;
};

const SuiteTest: React.FC<SuiteTestProps> = ({ content }) => {
    const groups = useMemo(() => buildSuiteGroupsFromContent(content), [content]);
    const allPaths = useMemo(() => collectSuitePaths(groups), [groups]);
    const canRun = allPaths.length > 0;
    const noItems = groups.every(group => group.entries.length === 0);

    useSuiteImportTree(allPaths, true);

    const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus | 'running'>>({});
    const [lastRunIdByEntryId, setLastRunIdByEntryId] = useState<Record<string, string>>({});
    const lastRunIdByEntryIdRef = useRef<Record<string, string>>({});
    const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

    const [suiteRunId, setSuiteRunId] = useState<string | null>(null);
    const [suiteRunState, setSuiteRunState] = useState<StepStatus>('default');
    const [leafReportsById, setLeafReportsById] = useState<Record<string, StepReportItem[]>>({});
    const [leafRunStateById, setLeafRunStateById] = useState<Record<string, StepStatus>>({});
    const pendingLeafResetRef = useRef<'all' | string[] | null>(null);
    const pendingEntriesToCancelRef = useRef<string[] | null>(null);
    const reportQueueRef = useRef<any[]>([]);
    const reportFlushTimerRef = useRef<number | null>(null);

    const resetLeafState = useCallback((mode: 'all' | readonly string[]) => {
        if (mode === 'all') {
            setLeafReportsById({});
            setLeafRunStateById({});
            return;
        }
        if (!Array.isArray(mode) || mode.length === 0) {
            return;
        }
        setLeafReportsById(prev => resetLeafStateMap(prev, mode));
        setLeafRunStateById(prev => resetLeafStateMap(prev, mode));
    }, [setLeafReportsById, setLeafRunStateById]);

    useEffect(() => {
        lastRunIdByEntryIdRef.current = lastRunIdByEntryId;
    }, [lastRunIdByEntryId]);

    const flushReportQueue = useCallback(() => {
        const queued = reportQueueRef.current;
        if (!queued.length) {
            return;
        }
        reportQueueRef.current = [];

        const queuedReports = [...queued];
        const runIdToEntryId: Record<string, string> = {};

        Object.entries(lastRunIdByEntryIdRef.current).forEach(([entryId, runId]) => {
            if (runId) {
                runIdToEntryId[runId] = entryId;
            }
        });

        queuedReports.forEach((message: any) => {
            const runId = typeof message.runId === 'string' ? message.runId : null;
            const groupIndex = message.groupIndex;
            const groupItemIndex = message.groupItemIndex;
            if (runId && typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
                const group = groups[groupIndex];
                const entry = group?.entries?.[groupItemIndex];
                if (entry?.id) {
                    runIdToEntryId[runId] = entry.id;
                }
            }
        });

        setLastRunIdByEntryId(prev => {
            const next = { ...prev };
            queuedReports.forEach((message: any) => {
                const runId = typeof message.runId === 'string' ? message.runId : null;
                const groupIndex = message.groupIndex;
                const groupItemIndex = message.groupItemIndex;
                if (runId && typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
                    const group = groups[groupIndex];
                    const entry = group?.entries?.[groupItemIndex];
                    if (entry?.id) {
                        next[entry.id] = runId;
                    }
                }
            });
            return next;
        });

        setStepStatuses(prev => {
            const next = { ...prev };
            queuedReports.forEach((message: any) => {
                const runId = typeof message.runId === 'string' ? message.runId : null;
                const groupIndex = message.groupIndex;
                const groupItemIndex = message.groupItemIndex;
                const nextStatus: StepStatus | 'running' = message.status || (message.success ? 'passed' : 'failed');

                if (runId) {
                    next[runId] = nextStatus;
                    return;
                }

                if (typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
                    const group = groups[groupIndex];
                    const entry = group?.entries?.[groupItemIndex];
                    if (entry?.id) {
                        next[entry.id] = nextStatus;
                    }
                }
            });
            return next;
        });

        setLeafRunStateById(prev => {
            const next = { ...prev };
            queuedReports.forEach((message: any) => {
                const runId = typeof message.runId === 'string' ? message.runId : null;
                const reportedId = typeof message.id === 'string' ? message.id : null;
                const targetId = reportedId || (runId ? runIdToEntryId[runId] : null);
                if (!targetId) {
                    return;
                }
                const scope = typeof message.scope === 'string' ? message.scope : '';
                const nextStatus: StepStatus | 'running' = message.status || (message.success ? 'passed' : 'failed');

                if (scope === 'suite-item' && nextStatus === 'running') {
                    next[targetId] = 'running';
                }
                if (scope === 'suite-item' && (nextStatus === 'passed' || nextStatus === 'failed')) {
                    next[targetId] = nextStatus;
                }
                if (scope === 'test-step-run' && message.success === false) {
                    next[targetId] = 'failed';
                }
            });
            return next;
        });

        setLeafReportsById(prev => {
            const next = { ...prev };
            queuedReports.forEach((message: any) => {
                const runId = typeof message.runId === 'string' ? message.runId : null;
                const reportedId = typeof message.id === 'string' ? message.id : null;
                const targetId = reportedId || (runId ? runIdToEntryId[runId] : null);
                const scope = typeof message.scope === 'string' ? message.scope : '';
                if (!targetId || scope !== 'test-step') {
                    return;
                }
                const normalized: StepReportItem = {
                    stepIndex: Number(message.stepIndex) || 1,
                    stepType: message.stepType === 'assert' ? 'assert' : 'check',
                    status: message.status === 'failed' ? 'failed' : 'passed',
                    comparison: typeof message.comparison === 'string' ? message.comparison : '',
                    title: typeof message.title === 'string' ? message.title : undefined,
                    details: typeof message.details === 'string' ? message.details : undefined,
                    actual: message.actual,
                    expected: message.expected,
                    timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now(),
                };
                const existing = next[targetId] || [];
                next[targetId] = [...existing, normalized];

                if (normalized.status === 'failed') {
                    setLeafRunStateById(state => ({ ...state, [targetId]: 'failed' }));
                }
            });
            return next;
        });
    }, [groups]);

    const [hierarchyByEntryPath, setHierarchyByEntryPath] = useState<Record<string, SuiteTreeNode>>({});

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const result: Record<string, SuiteTreeNode> = {};
            for (const group of groups) {
                for (const entry of group.entries) {
                    try {
                        const res = await getSuiteHierarchy(entry.path, entry.id);
                        const tree = res?.tree;
                        if (tree && typeof tree === 'object') {
                            result[entry.path] = tree;
                        }
                    } catch {
                        // Ignore; tree will treat it as non-suite.
                    }
                }
            }
            if (!cancelled) {
                setHierarchyByEntryPath(result as any);
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
        setSuiteRunState('default');
        pendingLeafResetRef.current = null;
        reportQueueRef.current = [];
        resetLeafState('all');
    }, [content, resetLeafState]);

    useEffect(() => {
        if (reportFlushTimerRef.current !== null) {
            window.clearInterval(reportFlushTimerRef.current);
        }
        reportFlushTimerRef.current = window.setInterval(() => {
            flushReportQueue();
        }, 500);
        return () => {
            if (reportFlushTimerRef.current !== null) {
                window.clearInterval(reportFlushTimerRef.current);
                reportFlushTimerRef.current = null;
            }
        };
    }, [flushReportQueue]);

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
                reportQueueRef.current = [];
                // New suite run: clear per-run mappings so old runIds can't
                // influence routing or step sequences.
                setLastRunIdByEntryId({});
                lastRunIdByEntryIdRef.current = {};
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
                setSuiteRunState(cancelled ? 'cancelled' : 'default');
                flushReportQueue();
                return;
            }

            if (message.command === 'suiteRunStopped') {
                const stoppedId = typeof message.suiteRunId === 'string' ? message.suiteRunId : null;
                if (stoppedId && suiteRunId && stoppedId !== suiteRunId) {
                    return;
                }
                setSuiteRunState('cancelled');

                // Mark currently running leaves as cancelled
                setLeafRunStateById((prev) => {
                    const next: typeof prev = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (next[k] === 'running') {
                            next[k] = 'cancelled';
                        }
                    });
                    return next;
                });
                // Also mark pending step statuses (UI-created) as cancelled and
                // mark their corresponding leaf states cancelled so the UI updates.
                setStepStatuses((prev) => {
                    const next: Record<string, StepStatus | 'running'> = { ...prev };
                    const pendingIds: string[] = [];
                    Object.keys(next).forEach((k) => {
                        if (next[k] === 'pending') {
                            next[k] = 'cancelled';
                            pendingIds.push(k);
                        }
                    });
                    pendingEntriesToCancelRef.current = pendingIds;
                    return next;
                });

                setLeafRunStateById((prev) => {
                    const next: typeof prev = { ...prev };
                    const pendingIds = pendingEntriesToCancelRef.current;
                    if (Array.isArray(pendingIds) && pendingIds.length) {
                        // Pending ids can be both top-level entry ids and imported
                        // suite/test ids. Mark them directly.
                        pendingIds.forEach((id) => {
                            if (typeof id === 'string' && id) {
                                next[id] = 'cancelled';
                            }
                        });
                    }
                    pendingEntriesToCancelRef.current = null;
                    return next;
                });
                flushReportQueue();
                return;
            }

            if (message.command === 'runFileReport') {
                const incomingSuiteRunId = typeof (message as any).suiteRunId === 'string' ? (message as any).suiteRunId : null;
                if (suiteRunId) {
                    // When the UI thinks we have an active suite run, only accept
                    // reports explicitly tagged with the same suiteRunId.
                    if (!incomingSuiteRunId || incomingSuiteRunId !== suiteRunId) {
                        return;
                    }
                } else {
                    // When idle, drop suite-tagged events from other panels/runs.
                    if (incomingSuiteRunId) {
                        return;
                    }
                }
                reportQueueRef.current.push(message);
                return;
            }
            if (message.command === 'validateFilesExistResult') {
                setMissingFiles(new Set(message.missing || []));
                return;
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [groups, suiteRunId, resetLeafState, flushReportQueue]);

    useEffect(() => {
        if (allPaths.length > 0) {
            window.vscode?.postMessage({ command: 'validateFilesExist', files: allPaths });
        } else {
            setMissingFiles(new Set());
        }
    }, [allPaths]);

    const onRunSuite = useCallback(() => {
        const next: Record<string, StepStatus> = {};
        const collectDescendantIds = (root: any, out: string[]) => {
            if (!root) return;
            const stack = [root];
            while (stack.length) {
                const node = stack.pop();
                if (!node || typeof node !== 'object') continue;
                if (typeof node.id === 'string' && node.id) {
                    out.push(node.id);
                }
                if (Array.isArray(node.children) && node.children.length) {
                    for (let i = 0; i < node.children.length; i++) stack.push(node.children[i]);
                }
            }
        };
        groups.forEach((group) =>
            group.entries.forEach((entry) => {
                // mark the top-level entry id
                next[entry.id] = 'pending';
                const root = hierarchyByEntryPath[entry.path] as any;
                if (root && typeof root === 'object') {
                    const ids: string[] = [];
                    // children under root are the imported nodes
                    collectDescendantIds(root, ids);
                    ids.forEach((id) => {
                        // avoid overwriting stronger existing markers
                        next[id] = 'pending';
                    });
                }
            })
        );
        setStepStatuses(next);
        const nextSuiteRunId = `suite-ui:${Date.now()}`;
        setSuiteRunId(nextSuiteRunId);
        setSuiteRunState('running');
        pendingLeafResetRef.current = 'all';
        resetLeafState('all');
        window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId });
    }, [groups, resetLeafState, hierarchyByEntryPath]);

    const onRunTargets = useCallback((target: string) => {
        const effectiveTarget = typeof target === 'string' ? target : '';
        if (!effectiveTarget) {
            return;
        }

        // For bundle runs we can't pre-mark by gi/ei.
        // Mark the target and any descendant bundle ids as pending so the UI shows progress.
        const pendingMap: Record<string, StepStatus> = {};
        const collectDescendantIds = (node: any, out: string[]) => {
            if (!node) return;
            const stack = [node];
            while (stack.length) {
                const n = stack.pop();
                if (!n || typeof n !== 'object') continue;
                if (typeof n.id === 'string' && n.id) out.push(n.id);
                if (Array.isArray(n.children) && n.children.length) stack.push(...n.children);
            }
        };

        // Try to find the node matching effectiveTarget inside each hierarchy tree.
        let found = false;
        for (const p of Object.keys(hierarchyByEntryPath)) {
            const root = (hierarchyByEntryPath as any)[p];
            if (!root) continue;
            const stack = [root];
            while (stack.length) {
                const n = stack.pop();
                if (!n || typeof n !== 'object') continue;
                if (n.id === effectiveTarget) {
                    found = true;
                    const ids: string[] = [];
                    collectDescendantIds(n, ids);
                    ids.forEach((id) => (pendingMap[id] = 'pending'));
                    break;
                }
                if (Array.isArray(n.children) && n.children.length) stack.push(...n.children);
            }
            if (found) break;
        }

        // If not found in hierarchies, still mark the effectiveTarget itself
        if (!found) {
            pendingMap[effectiveTarget] = 'pending';
        }

        setStepStatuses((prev) => ({ ...prev, ...pendingMap }));

        pendingLeafResetRef.current = [effectiveTarget];
        resetLeafState([effectiveTarget]);

        const nextSuiteRunId = `suite-ui:${Date.now()}`;
        setSuiteRunId(nextSuiteRunId);
        setSuiteRunState('running');
        window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId, target: effectiveTarget });
    }, [resetLeafState, hierarchyByEntryPath]);

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
            reportsById={leafReportsById}
            runStateById={leafRunStateById}
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
