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
import LoadTestReport from '../../loadtest/LoadTestReport';

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
    mode?: 'suite' | 'loadtest';
}

interface LoadTestConfig {
    threads?: number;
    repeat?: string | number;
    rampup?: string;
}

interface LoadRunSummary {
    tool?: string;
    scenario?: string;
    test?: string;
    config?: LoadTestConfig & { started_at?: string; finished_at?: string };
    summary?: {
        iterations?: number;
        requests?: number;
        successes?: number;
        failures?: number;
        success_rate?: number;
        failed_rate?: number;
        error_rate?: number;
        throughput?: number;
    };
    http?: {
        status_codes?: Record<string, number>;
        failed_requests?: number;
    };
    series?: Array<{
        timestamp: string;
        active_threads?: number;
        requests?: number;
        errors?: number;
        error_delta?: number;
        throughput?: number;
        response_time?: number;
        error_rate?: number;
    }>;
}

const overviewBoxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
    border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
    minWidth: 0,
};

const overviewIconStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

const overviewLabelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
};

const overviewValueStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
};

const overviewSubStyle: React.CSSProperties = {
    fontSize: 9,
};

function formatLoadPercent(value: number | undefined): string {
    return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-';
}

function formatLoadNumber(value: number | undefined, fractionDigits = 0): string {
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(fractionDigits) : '-';
}

const LoadOverviewCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    color: string;
    background: string;
    icon: 'passed' | 'failed' | 'total' | 'duration' | 'threads';
}> = ({ label, value, sub, color, background, icon }) => {
    const iconSvg = icon === 'passed'
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        : icon === 'failed'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            : icon === 'duration'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                : icon === 'threads'
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line><line x1="8" y1="17" x2="12" y2="17"></line></svg>;
    return (
        <div style={overviewBoxStyle}>
            <div style={{ ...overviewIconStyle, background, color }}>
                {iconSvg}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={overviewLabelStyle}>{label}</span>
                <span style={{ ...overviewValueStyle, color }}>{value}</span>
                {sub && <span style={{ ...overviewSubStyle, color }}>{sub}</span>}
            </div>
        </div>
    );
};

const LoadOverviewBoxes: React.FC<{
    load: LoadRunSummary | null;
    config: LoadTestConfig | null;
    duration?: string;
}> = ({ load, config, duration }) => {
    const summary = load?.summary || {};
    const requests = Number(summary.requests || 0);
    const successes = Number(summary.successes ?? Math.max(0, requests - Number(summary.failures || 0)));
    const failures = Number(summary.failures || 0);
    const iterations = Number(summary.iterations || 0);
    return (
        <div>
            <div className="label" style={{ marginBottom: 6 }}>Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
                <LoadOverviewCard
                    label="Passed"
                    value={formatLoadPercent(summary.success_rate)}
                    sub={`${formatLoadNumber(successes)} succeeded`}
                    color="var(--vscode-testing-iconPassed, #3fb950)"
                    background="rgba(63, 185, 80, 0.15)"
                    icon="passed"
                />
                <LoadOverviewCard
                    label="Failed"
                    value={formatLoadPercent(summary.error_rate ?? summary.failed_rate)}
                    sub={`${formatLoadNumber(failures)} failed`}
                    color="var(--vscode-testing-iconFailed, #f85149)"
                    background="rgba(248, 81, 73, 0.15)"
                    icon="failed"
                />
                <LoadOverviewCard
                    label="Total"
                    value={formatLoadNumber(requests)}
                    sub={`${formatLoadNumber(iterations)} iterations`}
                    color="var(--vscode-textLink-foreground, #58a6ff)"
                    background="rgba(88, 166, 255, 0.15)"
                    icon="total"
                />
                <LoadOverviewCard
                    label="Duration"
                    value={duration || '-'}
                    sub={summary.throughput != null ? `${formatLoadNumber(summary.throughput, 2)} req/s` : undefined}
                    color="var(--vscode-descriptionForeground, #8b949e)"
                    background="rgba(139, 148, 158, 0.15)"
                    icon="duration"
                />
                <LoadOverviewCard
                    label="Threads"
                    value={formatLoadNumber(load?.config?.threads ?? config?.threads)}
                    sub={load?.config?.rampup || config?.rampup ? `Ramp-up ${load?.config?.rampup || config?.rampup}` : undefined}
                    color="var(--vscode-charts-yellow, #d29922)"
                    background="rgba(210, 153, 34, 0.15)"
                    icon="threads"
                />
            </div>
        </div>
    );
};

const buildSuiteGroupsFromContent = (content: string, mode: 'suite' | 'loadtest' = 'suite'): SuiteGroup[] => {
    const parsed = parseYaml(content);
    if (mode === 'loadtest') {
        const test = typeof parsed?.test === 'string' ? parsed.test.trim() : '';
        return test ? [{ label: 'Test', entries: [{ id: 'loadtest-test-0', path: test }] }] : [];
    }
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

const buildLoadTestConfigFromContent = (content: string): LoadTestConfig | null => {
    const parsed = parseYaml(content);
    if (!parsed || typeof parsed !== 'object') {
        return null;
    }
    const config: LoadTestConfig = {};
    if (typeof parsed.threads === 'number') {
        config.threads = parsed.threads;
    }
    if (typeof parsed.repeat === 'number' || typeof parsed.repeat === 'string') {
        config.repeat = parsed.repeat;
    }
    if (typeof parsed.rampup === 'string') {
        config.rampup = parsed.rampup;
    }
    return Object.keys(config).length > 0 ? config : null;
};

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
    const allPaths: string[] = [];
    groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
    return allPaths;
};

const SuiteTest: React.FC<SuiteTestProps> = ({ content, mode = 'suite' }) => {
    const { mmtFilePath } = useContext(FileContext);
    const groups = useMemo(() => buildSuiteGroupsFromContent(content, mode), [content, mode]);
    const servers = useMemo(() => mode === 'loadtest' ? [] : buildServersFromContent(content), [content, mode]);
    const environment = useMemo(() => buildEnvironmentFromContent(content), [content]);
    const suiteExports = useMemo(() => buildExportsFromContent(content), [content]);
    const loadConfig = useMemo(() => mode === 'loadtest' ? buildLoadTestConfigFromContent(content) : null, [content, mode]);
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
    const [loadRunSummary, setLoadRunSummary] = useState<LoadRunSummary | null>(null);
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
                if (scope === 'suite-item' && (nextStatus === 'passed' || nextStatus === 'failed' || nextStatus === 'invalid')) {
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
        setLoadRunSummary(null);
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
                if (mode === 'loadtest') {
                    setLoadRunSummary(null);
                }
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
                } else if (mode === 'loadtest' && typeof (message as any).success === 'boolean') {
                    setSuiteRunState((message as any).success ? 'passed' : 'failed');
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
                if (mode === 'loadtest' && (message as any).load) {
                    setLoadRunSummary((message as any).load);
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
                if (mode === 'loadtest' && (message as any).scope === 'loadtest-summary' && (message as any).load) {
                    setLoadRunSummary((message as any).load);
                    return;
                }
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
    }, [groups, suiteRunId, resetLeafState, flushReportQueue, mode]);

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
                type: mode === 'loadtest' ? 'loadtest' : 'suite',
                leafReportsById,
                leafRunStateById,
                stepStatuses,
                suiteRunState,
                durationMs: suiteRunDurationMs,
                displayNameById,
                suiteName: suiteTitle,
                filePath: mmtFilePath,
                load: mode === 'loadtest'
                    ? (loadRunSummary || (loadConfig ? { config: loadConfig, test: groups[0]?.entries[0]?.path } : undefined))
                    : undefined,
            },
        });
    }, [leafReportsById, leafRunStateById, stepStatuses, suiteRunState, suiteRunDurationMs, displayNameById, suiteTitle, mmtFilePath, mode, loadConfig, groups, loadRunSummary]);

    const suiteExportDisabled = suiteRunState === 'running' || (mode === 'loadtest' ? !loadRunSummary : Object.keys(leafReportsById).length === 0);
    const runLabel = mode === 'loadtest' ? 'Run load test' : 'Run suite';
    const stopLabel = mode === 'loadtest' ? 'Stop load test' : 'Stop suite';

    const overviewStats = useMemo((): OverviewStats | null => {
        if (mode === 'loadtest') {
            if (!loadRunSummary && suiteRunState === 'default') {
                return null;
            }
            const requests = Number(loadRunSummary?.summary?.requests || 0);
            const failures = Number(loadRunSummary?.summary?.failures || 0);
            const successes = Number(loadRunSummary?.summary?.successes ?? Math.max(0, requests - failures));
            const failedRate = requests > 0 ? ((failures / requests) * 100).toFixed(1) : '0.0';
            const throughput = loadRunSummary?.summary?.throughput;
            const duration = suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined;
            return {
                passed: successes,
                failed: failures,
                total: requests,
                duration,
                failedSub: `${failedRate}% failed`,
                totalSub: `${requests} requests sent`,
                durationSub: throughput != null ? `${throughput.toFixed(2)} req/s` : undefined,
            };
        }
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
    }, [leafReportsById, suiteRunState, suiteRunDurationMs, mode, loadRunSummary]);

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
                                title={stopLabel}
                            >
                                <span className="codicon codicon-debug-stop" aria-hidden />
                                Stop
                            </button>
                        ) : (
                            <button
                                className="button-icon"
                                disabled={!canRun}
                                onClick={onRunSuite}
                                title={!canRun ? (mode === 'loadtest' ? 'No test file to run' : 'No suite files to run') : runLabel}
                            >
                                <span className="codicon codicon-run" aria-hidden />
                                {runLabel}
                            </button>
                        )}
                        <ExportReportButton disabled={suiteExportDisabled} onExport={handleExportReport} />
                    </div>
                </div>
                {noItems ? <div style={{ opacity: 0.8 }}>{mode === 'loadtest' ? 'No test file found under `test:`' : 'No suite items found under `tests:`'}</div> : (
                    <>
                        {mode === 'loadtest'
                            ? <LoadOverviewBoxes load={loadRunSummary} config={loadConfig} duration={suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined} />
                            : overviewStats && <OverviewBoxes stats={overviewStats} />}
                        {loadConfig && (
                            <>
                                <div className="label" style={{ marginBottom: 6 }}>Load</div>
                                <div style={{ marginBottom: 12, paddingLeft: 8 }}>
                                    {mode === 'loadtest' && groups[0]?.entries[0]?.path && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-beaker" style={{ fontSize: 14 }} aria-hidden />
                                            <span>Test: </span>
                                            <span
                                                title="Ctrl/Cmd+click to open test file"
                                                style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                                onClick={(event) => {
                                                    if (event.ctrlKey || event.metaKey) {
                                                        window.vscode?.postMessage({ command: 'openRelativeFile', filename: groups[0]?.entries[0]?.path });
                                                    }
                                                }}
                                            >
                                                <code>{groups[0].entries[0].path}</code>
                                            </span>
                                        </div>
                                    )}
                                    {loadConfig.threads != null && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-dashboard" style={{ fontSize: 14 }} aria-hidden />
                                            <span>Threads: <code>{loadConfig.threads}</code></span>
                                        </div>
                                    )}
                                    {loadConfig.repeat != null && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-sync" style={{ fontSize: 14 }} aria-hidden />
                                            <span>Repeat: <code>{String(loadConfig.repeat)}</code></span>
                                        </div>
                                    )}
                                    {loadConfig.rampup && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: 0.9 }}>
                                            <span className="codicon codicon-graph-line" style={{ fontSize: 14 }} aria-hidden />
                                            <span>Ramp-up: <code>{loadConfig.rampup}</code></span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
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
                        {mode === 'loadtest' ? (
                            <LoadTestReport
                                load={loadRunSummary}
                                config={loadConfig || undefined}
                            />
                        ) : (
                            <>
                                <div className="label" style={{ marginBottom: 10 }}>Tests</div>
                                {tree}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SuiteTest;
