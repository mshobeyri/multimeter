import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { formatDuration } from 'mmt-core/CommonData';
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
import ExportReportButton, { ReportFormat } from '../../shared/ExportReportButton';
import OverviewBoxes, { OverviewStats } from '../../shared/OverviewBoxes';
import { FileContext } from '../../fileContext';

/** Get basename from a file path. */
function basename(p: string): string {
    const parts = p.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || p;
}

/** Build a map from node id to display path by combining group entries and hierarchy trees. */
function buildDisplayNamesFromHierarchy(
    groups: SuiteGroup[],
    hierarchyByEntryPath: Record<string, SuiteTreeNode>
): Record<string, string> {
    const result: Record<string, string> = {};

    const getNodeLabel = (node: SuiteTreeNode): string => {
        if (node.kind === 'group') {
            return node.label;
        }
        if ('title' in node && node.title) {
            return node.title;
        }
        if ('path' in node && node.path) {
            return basename(node.path);
        }
        return node.id;
    };

    const traverse = (node: SuiteTreeNode, pathParts: string[]): void => {
        const label = getNodeLabel(node);
        const currentPath = node.kind === 'group' ? pathParts : [...pathParts, label];

        if (node.kind === 'test' || node.kind === 'missing' || node.kind === 'cycle') {
            result[node.id] = currentPath.join(' / ');
        }

        if ('children' in node && Array.isArray(node.children)) {
            for (const child of node.children) {
                traverse(child, currentPath);
            }
        }
    };

    // First, add display names for all top-level entries from groups
    for (const group of groups) {
        for (const entry of group.entries) {
            const hierarchy = hierarchyByEntryPath[entry.path];
            if (hierarchy) {
                // Entry is a suite - use its title or filename as the base, then traverse children
                const suiteLabel = getNodeLabel(hierarchy);
                result[entry.id] = suiteLabel;
                // Traverse children with the suite label as path prefix
                if ('children' in hierarchy && Array.isArray(hierarchy.children)) {
                    for (const child of hierarchy.children) {
                        traverse(child, [suiteLabel]);
                    }
                }
            } else {
                // Entry is a direct test file - use its filename
                result[entry.id] = basename(entry.path);
            }
        }
    }

    return result;
}

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

const buildServersFromContent = (content: string): string[] => {
    const parsed = parseYaml(content);
    if (!Array.isArray(parsed?.servers)) {
        return [];
    }
    return parsed.servers
        .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
};

interface SuiteEnvironmentConfig {
    preset?: string;
    file?: string;
    variables?: Record<string, unknown>;
}

const buildEnvironmentFromContent = (content: string): SuiteEnvironmentConfig | null => {
    const parsed = parseYaml(content);
    if (!parsed?.environment || typeof parsed.environment !== 'object') {
        return null;
    }
    const env = parsed.environment;
    const result: SuiteEnvironmentConfig = {};
    if (typeof env.preset === 'string') {
        result.preset = env.preset;
    }
    if (typeof env.file === 'string') {
        result.file = env.file;
    }
    if (env.variables && typeof env.variables === 'object') {
        result.variables = env.variables;
    }
    return Object.keys(result).length > 0 ? result : null;
};

const buildExportsFromContent = (content: string): string[] => {
    const parsed = parseYaml(content);
    if (!Array.isArray(parsed?.export)) {
        return [];
    }
    return parsed.export
        .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
};

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
    const allPaths: string[] = [];
    groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
    return allPaths;
};

const SuiteTest: React.FC<SuiteTestProps> = ({ content }) => {
    const { mmtFilePath } = useContext(FileContext);
    const groups = useMemo(() => buildSuiteGroupsFromContent(content), [content]);
    const servers = useMemo(() => buildServersFromContent(content), [content]);
    const environment = useMemo(() => buildEnvironmentFromContent(content), [content]);
    const suiteExports = useMemo(() => buildExportsFromContent(content), [content]);
    const suiteTitle = useMemo(() => {
        try {
            const parsed = parseYaml(content);
            return typeof parsed?.title === 'string' ? parsed.title : undefined;
        } catch {
            return undefined;
        }
    }, [content]);
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
    const suiteRunStartTimeRef = useRef<number | null>(null);
    const [suiteRunDurationMs, setSuiteRunDurationMs] = useState<number | null>(null);
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
            // For bundle-based suite runs, suite-item events carry both id
            // and runId directly. Use these to build the mapping so that
            // subsequent test-step events (which may only have runId) can
            // be routed to the correct tree leaf.
            if (runId && typeof message.id === 'string' && message.id && message.scope === 'suite-item') {
                runIdToEntryId[runId] = message.id;
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
                // Also register the mapping for bundle-based suite-item events
                // which carry id directly instead of groupIndex/groupItemIndex.
                if (runId && typeof message.id === 'string' && message.id && message.scope === 'suite-item') {
                    next[message.id] = runId;
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
                // test-step-run events use 'result' not 'status' or 'success'.
                const nextStatus: StepStatus | 'running' =
                    message.status ||
                    (typeof message.result === 'string' ? message.result : null) ||
                    (typeof message.success === 'boolean' ? (message.success ? 'passed' : 'failed') : null) ||
                    'failed';

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
                    stepType: message.stepType === 'assert' ? 'assert' : message.stepType === 'debug' ? 'debug' : 'check',
                    status: message.status === 'failed' ? 'failed' : 'passed',
                    title: typeof message.title === 'string' ? message.title : undefined,
                    details: typeof message.details === 'string' ? message.details : undefined,
                    expects: Array.isArray(message.expects) ? message.expects : [],
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
                flushReportQueue();
                // Derive pass/fail from the current leaf statuses
                if (cancelled) {
                    setSuiteRunState('cancelled');
                } else {
                    setStepStatuses(prev => {
                        const vals = Object.values(prev);
                        const hasFailed = vals.some(v => v === 'failed');
                        setSuiteRunState(hasFailed ? 'failed' : 'passed');
                        return prev;
                    });
                }
                if (suiteRunStartTimeRef.current) {
                    setSuiteRunDurationMs(Date.now() - suiteRunStartTimeRef.current);
                    suiteRunStartTimeRef.current = null;
                }
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
        suiteRunStartTimeRef.current = Date.now();
        setSuiteRunDurationMs(null);
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

    const displayNameById = useMemo(() => {
        return buildDisplayNamesFromHierarchy(groups, hierarchyByEntryPath);
    }, [groups, hierarchyByEntryPath]);

    const handleExportReport = useCallback((format: ReportFormat) => {
        window.vscode?.postMessage({
            command: 'exportReport',
            format,
            data: {
                type: 'suite',
                leafReportsById,
                leafRunStateById,
                stepStatuses,
                suiteRunState,
                durationMs: suiteRunDurationMs,
                displayNameById,
                suiteName: suiteTitle,
                filePath: mmtFilePath,
            },
        });
    }, [leafReportsById, leafRunStateById, stepStatuses, suiteRunState, suiteRunDurationMs, displayNameById, suiteTitle, mmtFilePath]);

    const suiteExportDisabled = suiteRunState === 'running' || Object.keys(leafReportsById).length === 0;

    const overviewStats = useMemo((): OverviewStats | null => {
        const allReports = Object.values(leafReportsById).flat();
        if (allReports.length === 0 && suiteRunState === 'default') {
            return null;
        }
        const passed = allReports.filter(r => r.status === 'passed').length;
        const failed = allReports.filter(r => r.status === 'failed').length;
        const total = allReports.length;
        const fileCount = Object.keys(leafReportsById).length;
        const duration = suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined;
        return {
            passed,
            failed,
            total,
            duration,
            failedSub: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
            totalSub: `${total} check${total !== 1 ? 's' : ''}`,
            durationSub: `${fileCount} file${fileCount !== 1 ? 's' : ''}`,
        };
    }, [leafReportsById, suiteRunState, suiteRunDurationMs]);

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
        <div style={{ overflow: 'auto', flex: 1, width: '100%' }}>
            <div className="test-flow-tree" style={{ paddingTop: 4 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: 8,
                        alignItems: 'center',
                        position: 'relative',
                        gap: 8,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8}}>
                        {suiteRunState === 'running' ? (
                            <button
                                className="button-icon"
                                onClick={onStopSuite}
                                title="Stop suite"
                            >
                                <span className="codicon codicon-debug-stop" aria-hidden />
                                Stop
                            </button>
                        ) : (
                            <button
                                className="button-icon"
                                disabled={!canRun}
                                onClick={onRunSuite}
                                title={!canRun ? 'No suite files to run' : 'Run suite'}
                            >
                                <span className="codicon codicon-run" aria-hidden />
                                Run suite
                            </button>
                        )}
                        <ExportReportButton disabled={suiteExportDisabled} onExport={handleExportReport} />
                    </div>
                </div>
                {noItems ? <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div> : (
                    <>
                        {overviewStats && <OverviewBoxes stats={overviewStats} />}
                        {environment && (
                            <>
                                <div className="label" style={{ marginBottom: 6 }}>Environment</div>
                                <div style={{ marginBottom: 12, paddingLeft: 8 }}>
                                    {environment.preset && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-symbol-namespace" style={{ fontSize: 14 }} aria-hidden />
                                            <span>Preset: <code>{environment.preset}</code></span>
                                        </div>
                                    )}
                                    {environment.file && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-file" style={{ fontSize: 14 }} aria-hidden />
                                            <span>File: <code>{environment.file}</code></span>
                                        </div>
                                    )}
                                    {environment.variables && Object.keys(environment.variables).length > 0 && (
                                        <div style={{ padding: '2px 0', opacity: 0.9 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <span className="codicon codicon-symbol-variable" style={{ fontSize: 14 }} aria-hidden />
                                                <span>Variables:</span>
                                            </div>
                                            <div style={{ paddingLeft: 20 }}>
                                                {Object.entries(environment.variables).map(([key, val]) => (
                                                    <div key={key} style={{ padding: '1px 0', fontSize: '0.9em' }}>
                                                        <code>{key}</code>: <code>{JSON.stringify(val)}</code>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {servers.length > 0 && (
                            <>
                                <div className="label" style={{ marginBottom: 6 }}>Servers</div>
                                <div style={{ marginBottom: 12, paddingLeft: 8 }}>
                                    {servers.map((s, i) => {
                                        const name = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                                <span className="codicon codicon-server-environment" style={{ fontSize: 14 }} aria-hidden />
                                                <span title={s}>{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        {suiteExports.length > 0 && (
                            <>
                                <div className="label" style={{ marginBottom: 6 }}>Exports</div>
                                <div style={{ marginBottom: 12, paddingLeft: 8 }}>
                                    {suiteExports.map((ex, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-export" style={{ fontSize: 14 }} aria-hidden />
                                            <span><code>{ex}</code></span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        <div className="label" style={{ marginBottom: 10 }}>Tests</div>
                        {tree}
                    </>
                )}
            </div>
        </div>
    );
};

export default SuiteTest;
