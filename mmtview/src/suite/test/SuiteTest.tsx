import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { parseYaml } from 'mmt-core/markupConvertor';
import { formatDuration } from 'mmt-core/CommonData';
import type { SuiteEnvironment } from 'mmt-core/SuiteData';
import { formatReportRelativeTime } from 'mmt-core/reportFormat';
import { splitSuiteGroups } from 'mmt-core/suiteParsePack';
import { parseSuiteYamlFilter } from 'mmt-core/suiteTagFilter';
import { createSuiteNodeId } from 'mmt-core/suiteNodeId';
import { StepStatus } from '../../shared/types';
import { SuiteEntry, SuiteGroup } from '../types';
import { SuiteTestTree } from './';
import type { SuiteTestTreeHandle } from './SuiteTestTree';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { useSuiteImportTree } from './useSuiteImportTree';
import { SuiteTreeNode, suiteTreeChildren } from './suiteHierarchy';
import { getSuiteHierarchy } from '../../vsAPI';
import { resetLeafStateMap } from './leafStateReset';
import {
    buildFullSuitePendingState,
    buildTargetPendingState,
    isUnderSuiteTarget,
} from './suiteRunStatus';
import {
    fingerprintHierarchyByEntryId,
    remapSuiteTargetId,
} from './suiteHierarchyFingerprint';
import { statusIconFor } from '../../shared/Common';
import ExportReportButton, { ReportFormat } from '../../shared/ExportReportButton';
import ReportStatusFilterButton from '../../shared/ReportStatusFilterButton';
import ReportExpandCollapseButton from '../../shared/ReportExpandCollapseButton';
import { ReportStatusFilter } from '../../shared/reportStatusFilter';
import OverviewBoxes, { OverviewStats } from '../../shared/OverviewBoxes';
import { FileContext } from '../../fileContext';
import { HideWhenYamlError } from '../../api/YamlErrorWarning';
import LoadTestReport, { LoadMetricsOverview } from '../../loadtest/LoadTestReport';
import { runInCoreMenuItem } from '../../components/ContextMenuHost';
import { duplicateSuiteServerPaths, isDuplicateSuiteServerPath } from '../../text/validator';
import RunStopToggle from '../../components/RunStopToggle';

/** Get basename from a file path. */
function basename(p: string): string {
    const parts = p.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || p;
}

/** Build a map from node id to display path by combining group entries and hierarchy trees. */
function buildDisplayNamesFromHierarchy(
    groups: SuiteGroup[],
    hierarchyByEntryId: Record<string, SuiteTreeNode>
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

        if (node.kind === 'test' || node.kind === 'suite' || node.kind === 'server' || node.kind === 'missing' || node.kind === 'cycle') {
            result[node.id] = currentPath.join(' / ');
        }

        for (const child of suiteTreeChildren(node)) {
            traverse(child, currentPath);
        }
    };

    // First, add display names for all top-level entries from groups
    for (const group of groups) {
        for (const entry of group.entries) {
            const hierarchy = hierarchyByEntryId[entry.id];
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
    onFlowchartStateChange?: (state: SuiteFlowchartState) => void;
}

export interface SuiteFlowchartState {
    groups: SuiteGroup[];
    hierarchyByEntryId: Record<string, SuiteTreeNode>;
    missingFiles: Set<string>;
    noItems: boolean;
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

function formatOverviewRelativeTime(value: number | string | null | undefined): string | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    return formatReportRelativeTime(value);
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
    isRunning?: boolean;
}> = ({ load, config, duration, isRunning }) => {
    const summary = load?.summary || {};
    const requests = Number(summary.requests || 0);
    const successes = Number(summary.successes ?? Math.max(0, requests - Number(summary.failures || 0)));
    const failures = Number(summary.failures || 0);
    const iterations = Number(summary.iterations || 0);
    const series = load?.series || [];
    const latestSeriesPoint = series.length > 0 ? series[series.length - 1] : undefined;
    const activeThreads = Number(latestSeriesPoint?.active_threads || 0);
    const configuredThreads = Number(load?.config?.threads ?? config?.threads ?? 0);
    const rampup = load?.config?.rampup || config?.rampup;
    const threadValue = isRunning ? activeThreads : configuredThreads;
    const threadSub = isRunning
        ? (configuredThreads > 0 ? `/${formatLoadNumber(configuredThreads)}` : undefined)
        : (rampup ? `Ramp-up ${rampup}` : undefined);
    return (
        <div>
            <div className="label is-field">Overview</div>
            <div className="stat-grid">
                <LoadOverviewCard
                    label="Passed"
                    value={formatLoadPercent(summary.success_rate)}
                    sub={`${formatLoadNumber(successes)}`}
                    color="var(--vscode-testing-iconPassed, #3fb950)"
                    background="rgba(63, 185, 80, 0.15)"
                    icon="passed"
                />
                <LoadOverviewCard
                    label="Failed"
                    value={formatLoadPercent(summary.error_rate ?? summary.failed_rate)}
                    sub={`${formatLoadNumber(failures)}`}
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
                    sub={formatOverviewRelativeTime(load?.config?.started_at)}
                    color="var(--vscode-descriptionForeground, #8b949e)"
                    background="rgba(139, 148, 158, 0.15)"
                    icon="duration"
                />
                <LoadOverviewCard
                    label="Threads"
                    value={formatLoadNumber(threadValue)}
                    sub={threadSub}
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
    const items: string[] = Array.isArray(parsed?.items)
        ? parsed.items.map((value: any) => (typeof value === 'string' ? value.trim() : '').trim()).filter(Boolean)
        : (Array.isArray(parsed?.tests)
            ? parsed.tests.map((value: any) => (typeof value === 'string' ? value.trim() : '').trim()).filter(Boolean)
            : []);

    if (!items.length) {
        return [];
    }

    let grouped: string[][] = [];
    try {
        grouped = splitSuiteGroups([...items]);
    } catch {
        const fallbackGroups: string[][] = [];
        let current: string[] = [];
        const flush = () => {
            if (current.length) {
                fallbackGroups.push(current);
                current = [];
            }
        };
        items.forEach((entry) => {
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

const buildEnvironmentFromContent = (content: string): SuiteEnvironment | null => {
    const parsed = parseYaml(content);
    if (!parsed?.environment || typeof parsed.environment !== 'object') {
        return null;
    }
    const env = parsed.environment;
    const result: SuiteEnvironment = {};
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

const buildFilterFromContent = (content: string): { only: string[]; skip: string[] } => {
    const parsed = parseYaml(content);
    const filter = parseSuiteYamlFilter(parsed?.filter);
    return {
        only: filter?.only ?? [],
        skip: filter?.skip ?? [],
    };
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

const SuiteTest: React.FC<SuiteTestProps> = ({ content, mode = 'suite', onFlowchartStateChange }) => {
    const { mmtFilePath } = useContext(FileContext);
    const groups = useMemo(() => buildSuiteGroupsFromContent(content, mode), [content, mode]);
    const servers = useMemo(() => mode === 'loadtest' ? [] : buildServersFromContent(content), [content, mode]);
    const environment = useMemo(() => buildEnvironmentFromContent(content), [content]);
    const suiteExports = useMemo(() => buildExportsFromContent(content), [content]);
    const tagFilter = useMemo(() => buildFilterFromContent(content), [content]);
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

    const [lastRunIdByEntryId, setLastRunIdByEntryId] = useState<Record<string, string>>({});
    const lastRunIdByEntryIdRef = useRef<Record<string, string>>({});
    const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

    const [suiteRunId, setSuiteRunId] = useState<string | null>(null);
    const suiteRunIdRef = useRef<string | null>(null);
    const ignoredSuiteRunIdsRef = useRef<Set<string>>(new Set());
    const [suiteRunState, setSuiteRunState] = useState<StepStatus>('default');
    const [loadRunSummary, setLoadRunSummary] = useState<LoadRunSummary | null>(null);
    const [leafReportsById, setLeafReportsById] = useState<Record<string, StepReportItem[]>>({});
    const [leafRunStateById, setLeafRunStateById] = useState<Record<string, StepStatus>>({});
    const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
    const [allTreeCollapsed, setAllTreeCollapsed] = useState(true);
    const suiteTreeRef = useRef<SuiteTestTreeHandle>(null);
    const suiteRunStartTimeRef = useRef<number | null>(null);
    const [suiteRunStartedAt, setSuiteRunStartedAt] = useState<number | null>(null);
    const [suiteRunDurationMs, setSuiteRunDurationMs] = useState<number | null>(null);
    const pendingLeafResetRef = useRef<'all' | string[] | null>(null);
    /** Partial-run target id; null means full suite run (all ids allowed). */
    const partialRunTargetRef = useRef<string | null>(null);
    const reportQueueRef = useRef<any[]>([]);
    const reportFlushTimerRef = useRef<number | null>(null);
    const durationTimerRef = useRef<number | null>(null);

    const trimIgnoredSuiteRuns = useCallback(() => {
        if (ignoredSuiteRunIdsRef.current.size <= 10) {
            return;
        }
        const first = ignoredSuiteRunIdsRef.current.values().next();
        if (!first.done) {
            ignoredSuiteRunIdsRef.current.delete(first.value);
        }
    }, []);

    const beginSuiteRun = useCallback((nextSuiteRunId: string) => {
        if (suiteRunIdRef.current) {
            ignoredSuiteRunIdsRef.current.add(suiteRunIdRef.current);
            trimIgnoredSuiteRuns();
        }
        suiteRunIdRef.current = nextSuiteRunId;
        setSuiteRunId(nextSuiteRunId);
        reportQueueRef.current = [];
    }, [trimIgnoredSuiteRuns]);

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
        const allowed = (id: string | null | undefined) =>
            isUnderSuiteTarget(partialRunTargetRef.current, id);

        // suite-item events carry id + runId; map runId → id for later test-step routing.
        queuedReports.forEach((message: any) => {
            const runId = typeof message.runId === 'string' ? message.runId : null;
            if (runId && typeof message.id === 'string' && message.id && message.scope === 'suite-item') {
                runIdToEntryId[runId] = message.id;
            }
        });

        const runStatePatches: Record<string, StepStatus> = {};
        const reportPatches: Record<string, StepReportItem[]> = {};

        queuedReports.forEach((message: any) => {
            const runId = typeof message.runId === 'string' ? message.runId : null;
            const reportedId = typeof message.id === 'string' ? message.id : null;
            const targetId = reportedId || (runId ? runIdToEntryId[runId] : null);
            if (!targetId || !allowed(targetId)) {
                return;
            }
            const scope = typeof message.scope === 'string' ? message.scope : '';
            if (scope === 'suite-item') {
                const status = message.status as StepStatus | undefined;
                if (status === 'running' || status === 'passed' || status === 'failed' || status === 'invalid' || status === 'cancelled' || status === 'skipped') {
                    if (!(status === 'passed' && runStatePatches[targetId] === 'failed')) {
                        runStatePatches[targetId] = status;
                    }
                }
                return;
            }
            if (scope === 'test-step-run' &&
                (message.success === false || message.result === 'failed')) {
                runStatePatches[targetId] = 'failed';
                return;
            }
            if (scope !== 'test-step') {
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
                cached: message.cached === true ? true : undefined,
            };
            if (!reportPatches[targetId]) {
                reportPatches[targetId] = [];
            }
            reportPatches[targetId].push(normalized);
            if (normalized.status === 'failed') {
                runStatePatches[targetId] = 'failed';
            }
        });

        setLastRunIdByEntryId(prev => {
            const next = { ...prev };
            queuedReports.forEach((message: any) => {
                const runId = typeof message.runId === 'string' ? message.runId : null;
                if (runId && typeof message.id === 'string' && message.id && message.scope === 'suite-item') {
                    next[message.id] = runId;
                }
            });
            return next;
        });

        const runStateIds = Object.keys(runStatePatches);
        if (runStateIds.length > 0) {
            setLeafRunStateById(prev => {
                const next = { ...prev };
                runStateIds.forEach((id) => {
                    next[id] = runStatePatches[id];
                });
                return next;
            });
        }

        const reportIds = Object.keys(reportPatches);
        if (reportIds.length > 0) {
            setLeafReportsById(prev => {
                const next = { ...prev };
                reportIds.forEach((id) => {
                    next[id] = [...(next[id] || []), ...reportPatches[id]];
                });
                return next;
            });
        }
    }, []);

    const [hierarchyByEntryId, setHierarchyByEntryId] = useState<Record<string, SuiteTreeNode>>({});
    const duplicateServerPathKeys = useMemo(() => {
        const itemServerPaths: string[] = [];
        for (const group of groups) {
            for (const entry of group.entries) {
                if (entry?.id && hierarchyByEntryId[entry.id]?.kind === 'server') {
                    itemServerPaths.push(entry.path);
                }
            }
        }
        return duplicateSuiteServerPaths(servers, allPaths, itemServerPaths);
    }, [servers, groups, allPaths, hierarchyByEntryId]);
    const duplicateServerIds = useMemo(() => {
        const ids = new Set<string>();
        for (const group of groups) {
            for (const entry of group.entries) {
                if (!entry?.id || hierarchyByEntryId[entry.id]?.kind !== 'server') {
                    continue;
                }
                if (isDuplicateSuiteServerPath(entry.path, duplicateServerPathKeys)) {
                    ids.add(entry.id);
                }
            }
        }
        return ids;
    }, [groups, hierarchyByEntryId, duplicateServerPathKeys]);
    const hierarchyByEntryIdRef = useRef<Record<string, SuiteTreeNode>>({});
    hierarchyByEntryIdRef.current = hierarchyByEntryId;

    const hierarchyMissingPaths = useMemo(() => {
        const missing = new Set<string>();
        const walk = (node: any) => {
            if (!node || typeof node !== 'object') {
                return;
            }
            if (node.kind === 'missing' && typeof node.path === 'string' && node.path) {
                missing.add(node.path);
            }
            if (Array.isArray(node.children)) {
                for (const child of node.children) {
                    walk(child);
                }
            }
        };
        Object.values(hierarchyByEntryId).forEach(walk);
        return missing;
    }, [hierarchyByEntryId]);

    const effectiveMissingFiles = useMemo(() => {
        if (hierarchyMissingPaths.size === 0) {
            return missingFiles;
        }
        const merged = new Set(missingFiles);
        hierarchyMissingPaths.forEach((path) => merged.add(path));
        return merged;
    }, [missingFiles, hierarchyMissingPaths]);

    useEffect(() => {
        onFlowchartStateChange?.({ groups, hierarchyByEntryId, missingFiles: effectiveMissingFiles, noItems });
    }, [groups, hierarchyByEntryId, effectiveMissingFiles, noItems, onFlowchartStateChange]);

    const fetchHierarchyByEntryId = useCallback(async (): Promise<Record<string, SuiteTreeNode>> => {
        const result: Record<string, SuiteTreeNode> = {};
        const tasks: Array<Promise<void>> = [];
        for (const group of groups) {
            for (const entry of group.entries) {
                tasks.push((async () => {
                    try {
                        const res = await getSuiteHierarchy(entry.path, entry.id);
                        const tree = res?.tree;
                        if (tree && typeof tree === 'object') {
                            // Key by entry id (position), not path — duplicate
                            // items like two `suite1.mmt` rows must keep independent trees.
                            result[entry.id] = tree;
                        }
                    } catch {
                        // Ignore; tree will treat it as non-suite.
                    }
                })());
            }
        }
        await Promise.all(tasks);
        return result;
    }, [groups]);

    /** Rebuild hierarchy from current YAML; update UI only when structure changed. */
    const ensureHierarchyFresh = useCallback(async (): Promise<Record<string, SuiteTreeNode>> => {
        const next = await fetchHierarchyByEntryId();
        const previous = hierarchyByEntryIdRef.current;
        if (fingerprintHierarchyByEntryId(next) !== fingerprintHierarchyByEntryId(previous)) {
            hierarchyByEntryIdRef.current = next;
            setHierarchyByEntryId(next);
        }
        return next;
    }, [fetchHierarchyByEntryId]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const result = await fetchHierarchyByEntryId();
            if (cancelled) {
                return;
            }
            const previous = hierarchyByEntryIdRef.current;
            if (fingerprintHierarchyByEntryId(result) === fingerprintHierarchyByEntryId(previous)) {
                return;
            }
            hierarchyByEntryIdRef.current = result;
            setHierarchyByEntryId(result);
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [fetchHierarchyByEntryId]);

    useEffect(() => {
        setSuiteRunId(null);
        setSuiteRunState('default');
        setLoadRunSummary(null);
        setSuiteRunStartedAt(null);
        pendingLeafResetRef.current = null;
        partialRunTargetRef.current = null;
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
        if (durationTimerRef.current !== null) {
            window.clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
        if (suiteRunState !== 'running' || !suiteRunStartTimeRef.current) {
            return;
        }
        durationTimerRef.current = window.setInterval(() => {
            if (suiteRunStartTimeRef.current) {
                setSuiteRunDurationMs(Date.now() - suiteRunStartTimeRef.current);
            }
        }, 250);
        return () => {
            if (durationTimerRef.current !== null) {
                window.clearInterval(durationTimerRef.current);
                durationTimerRef.current = null;
            }
        };
    }, [suiteRunState]);

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
                if (ignoredSuiteRunIdsRef.current.has(nextSuiteRunId)) {
                    return;
                }
                // Accept start for the active run, or adopt it if the UI has not
                // bound a suiteRunId yet (e.g. host-generated id).
                if (suiteRunIdRef.current && suiteRunIdRef.current !== nextSuiteRunId) {
                    ignoredSuiteRunIdsRef.current.add(suiteRunIdRef.current);
                    trimIgnoredSuiteRuns();
                    suiteRunIdRef.current = nextSuiteRunId;
                } else if (!suiteRunIdRef.current) {
                    suiteRunIdRef.current = nextSuiteRunId;
                }
                reportQueueRef.current = [];
                // New suite run: clear per-run mappings so old runIds can't
                // influence routing or step sequences.
                setLastRunIdByEntryId({});
                lastRunIdByEntryIdRef.current = {};
                setSuiteRunId(nextSuiteRunId);
                setSuiteRunState('running');
                const startedAt = typeof (message as any).startedAt === 'number' ? (message as any).startedAt : Date.now();
                suiteRunStartTimeRef.current = startedAt;
                setSuiteRunStartedAt(startedAt);
                if (mode === 'loadtest') {
                    setLoadRunSummary(null);
                }
                // Clear prior reports for this run, but do not wipe leafRunStateById —
                // onRunSuite / onRunTargets already primed pending icons for nodes that
                // will run. Resetting run state here made pending disappear immediately.
                const hint = pendingLeafResetRef.current;
                pendingLeafResetRef.current = null;
                if (hint === 'all') {
                    setLeafReportsById({});
                } else if (Array.isArray(hint) && hint.length) {
                    setLeafReportsById((prev) => resetLeafStateMap(prev, hint));
                } else {
                    resetLeafState('all');
                }
                return;
            }

            if (message.command === 'suiteRunEnd') {
                const endedId = typeof message.suiteRunId === 'string' ? message.suiteRunId : null;
                if (endedId && ignoredSuiteRunIdsRef.current.has(endedId)) {
                    return;
                }
                if (endedId && suiteRunIdRef.current && endedId !== suiteRunIdRef.current) {
                    return;
                }
                const cancelled = Boolean((message as any).cancelled);
                flushReportQueue();
                // Clear stuck "running" on own nodes only (no child→parent rollup).
                setLeafRunStateById((prev) => {
                    const next = { ...prev };
                    let changed = false;
                    Object.keys(next).forEach((id) => {
                        if (next[id] !== 'running') {
                            return;
                        }
                        if (!isUnderSuiteTarget(partialRunTargetRef.current, id)) {
                            return;
                        }
                        next[id] = cancelled ? 'cancelled' : 'failed';
                        changed = true;
                    });
                    return changed ? next : prev;
                });
                partialRunTargetRef.current = null;
                if (cancelled) {
                    setSuiteRunState('cancelled');
                } else if (mode === 'loadtest' && typeof (message as any).success === 'boolean') {
                    setSuiteRunState((message as any).success ? 'passed' : 'failed');
                } else {
                    setLeafRunStateById((prev) => {
                        const vals = Object.values(prev);
                        const hasFailed = vals.some(v => v === 'failed');
                        const hasInvalid = vals.some(v => v === 'invalid');
                        setSuiteRunState(
                            hasFailed ? 'failed' :
                            hasInvalid ? 'invalid' :
                            vals.some(v => v === 'skipped') && !vals.some(v => v === 'passed' || v === 'running') ? 'skipped' :
                            'passed');
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
                if (stoppedId && ignoredSuiteRunIdsRef.current.has(stoppedId)) {
                    return;
                }
                if (stoppedId && suiteRunIdRef.current && stoppedId !== suiteRunIdRef.current) {
                    return;
                }
                setSuiteRunState('cancelled');
                setLeafRunStateById((prev) => {
                    const next: typeof prev = { ...prev };
                    Object.keys(next).forEach((k) => {
                        if (next[k] === 'running' || next[k] === 'pending') {
                            next[k] = 'cancelled';
                        }
                    });
                    return next;
                });
                partialRunTargetRef.current = null;
                flushReportQueue();
                return;
            }

            if (message.command === 'runFileReport' || message.command === 'runFileReports') {
                const incomingReports = message.command === 'runFileReports' && Array.isArray(message.reports)
                    ? message.reports
                    : [message];
                incomingReports.forEach((report: any) => {
                    const incomingSuiteRunId = typeof report.suiteRunId === 'string'
                        ? report.suiteRunId
                        : (typeof message.suiteRunId === 'string' ? message.suiteRunId : null);
                    if (incomingSuiteRunId && ignoredSuiteRunIdsRef.current.has(incomingSuiteRunId)) {
                        return;
                    }
                    const activeId = suiteRunIdRef.current;
                    if (activeId) {
                        if (!incomingSuiteRunId || incomingSuiteRunId !== activeId) {
                            return;
                        }
                    } else if (incomingSuiteRunId) {
                        return;
                    }
                    if (mode === 'loadtest' && report.scope === 'loadtest-summary' && report.load) {
                        setLoadRunSummary(report.load);
                        return;
                    }
                    reportQueueRef.current.push(report);
                });
                return;
            }
            if (message.command === 'validateFilesExistResult') {
                setMissingFiles(new Set(message.missing || []));
                return;
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [groups, resetLeafState, flushReportQueue, mode, trimIgnoredSuiteRuns]);

    useEffect(() => {
        if (allPaths.length > 0) {
            window.vscode?.postMessage({ command: 'validateFilesExist', files: allPaths });
        } else {
            setMissingFiles(new Set());
        }
    }, [allPaths]);

    const onRunSuite = useCallback(async () => {
        if (suiteRunState === 'pending' || suiteRunState === 'running') {
            return;
        }
        // Show Starting… before hierarchy fetch / pending-state work.
        flushSync(() => {
            setSuiteRunState('pending');
            setLeafReportsById({});
            setSuiteRunDurationMs(0);
        });
        try {
            const hierarchy = await ensureHierarchyFresh();
            const nextSuiteRunId = `suite-ui:${Date.now()}`;
            const startedAt = Date.now();
            beginSuiteRun(nextSuiteRunId);
            suiteRunStartTimeRef.current = startedAt;
            setSuiteRunStartedAt(startedAt);
            pendingLeafResetRef.current = 'all';
            partialRunTargetRef.current = null;
            // Mark every known runnable node pending until its own suite-item arrives.
            setLeafRunStateById(buildFullSuitePendingState(groups, hierarchy));
            setSuiteRunState('running');
            window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId });
        } catch (error) {
            setSuiteRunState('default');
            throw error;
        }
    }, [groups, ensureHierarchyFresh, beginSuiteRun, suiteRunState]);

    const onRunTargets = useCallback(async (target: string) => {
        const requestedTarget = typeof target === 'string' ? target : '';
        if (!requestedTarget) {
            return;
        }
        if (suiteRunState === 'pending' || suiteRunState === 'running') {
            return;
        }

        flushSync(() => {
            setSuiteRunState('pending');
            setSuiteRunDurationMs(0);
        });
        try {
            const previousHierarchy = hierarchyByEntryIdRef.current;
            const hierarchy = await ensureHierarchyFresh();
            const effectiveTarget = remapSuiteTargetId(requestedTarget, previousHierarchy, hierarchy);

            pendingLeafResetRef.current = [effectiveTarget];
            // Prefix allowlist: target + descendants (suite-node:1.1 → suite-node:1.1.*).
            partialRunTargetRef.current = effectiveTarget;
            const pendingMap = buildTargetPendingState(effectiveTarget, groups, hierarchy);
            setLeafReportsById((prev) => resetLeafStateMap(prev, [effectiveTarget]));
            setLeafRunStateById((prev) => ({
                ...resetLeafStateMap(prev, [effectiveTarget]),
                ...pendingMap,
            }));

            const nextSuiteRunId = `suite-ui:${Date.now()}`;
            const startedAt = Date.now();
            beginSuiteRun(nextSuiteRunId);
            suiteRunStartTimeRef.current = startedAt;
            setSuiteRunStartedAt(startedAt);
            setSuiteRunState('running');
            window.vscode?.postMessage({ command: 'runSuite', suiteRunId: nextSuiteRunId, target: effectiveTarget });
        } catch (error) {
            setSuiteRunState('default');
            throw error;
        }
    }, [groups, ensureHierarchyFresh, beginSuiteRun, suiteRunState]);

    const onRunSuiteInCore = useCallback(async () => {
        await ensureHierarchyFresh();
        window.vscode?.postMessage({
            command: 'runSuite',
            suiteRunId: `suite-logs:${Date.now()}`,
            report: { type: 'lifecycle' },
        });
    }, [ensureHierarchyFresh]);

    const onRunTargetsInCore = useCallback(async (target: string) => {
        const requestedTarget = typeof target === 'string' ? target : '';
        if (!requestedTarget) {
            return;
        }
        const previousHierarchy = hierarchyByEntryIdRef.current;
        const hierarchy = await ensureHierarchyFresh();
        const effectiveTarget = remapSuiteTargetId(requestedTarget, previousHierarchy, hierarchy);
        window.vscode?.postMessage({
            command: 'runSuite',
            suiteRunId: `suite-logs:${Date.now()}`,
            target: effectiveTarget,
            report: { type: 'lifecycle' },
        });
    }, [ensureHierarchyFresh]);

    const onStopSuite = useCallback(() => {
        if (!suiteRunId) {
            return;
        }
        window.vscode?.postMessage({ command: 'stopSuiteRun', suiteRunId });
    }, [suiteRunId]);

    const displayNameById = useMemo(() => {
        return buildDisplayNamesFromHierarchy(groups, hierarchyByEntryId);
    }, [groups, hierarchyByEntryId]);

    const handleExportReport = useCallback((format: ReportFormat) => {
        window.vscode?.postMessage({
            command: 'exportReport',
            format,
            data: {
                type: mode === 'loadtest' ? 'loadtest' : 'suite',
                leafReportsById,
                leafRunStateById,
                suiteRunState,
                startedAt: suiteRunStartedAt,
                durationMs: suiteRunDurationMs,
                displayNameById,
                suiteName: suiteTitle,
                filePath: mmtFilePath,
                load: mode === 'loadtest'
                    ? (loadRunSummary || (loadConfig ? { config: loadConfig, test: groups[0]?.entries[0]?.path } : undefined))
                    : undefined,
            },
        });
    }, [leafReportsById, leafRunStateById, suiteRunState, suiteRunStartedAt, suiteRunDurationMs, displayNameById, suiteTitle, mmtFilePath, mode, loadConfig, groups, loadRunSummary]);

    const suiteExportDisabled =
        suiteRunState === 'pending' ||
        suiteRunState === 'running' ||
        (mode === 'loadtest' ? !loadRunSummary : Object.keys(leafReportsById).length === 0);
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
            const duration = suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined;
            return {
                passed: successes,
                failed: failures,
                total: requests,
                duration,
                failedSub: `${failedRate}%`,
                totalSub: `${requests} requests sent`,
                            durationSub: formatOverviewRelativeTime(loadRunSummary?.config?.started_at || suiteRunStartedAt),
            };
        }
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let fileCount = 0;
        for (const reports of Object.values(leafReportsById)) {
            fileCount += 1;
            for (const report of reports) {
                if (report.status === 'failed') {
                    failed += 1;
                } else {
                    passed += 1;
                }
            }
        }
        for (const status of Object.values(leafRunStateById)) {
            if (status === 'skipped') {
                skipped += 1;
            }
        }
        const total = passed + failed + skipped;
        if (total === 0 && (suiteRunState === 'default' || suiteRunState === 'pending')) {
            return null;
        }
        const duration = suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined;
        return {
            passed,
            failed,
            total,
            duration,
            failedSub: total > 0 ? `${((failed / total) * 100).toFixed(1)}%` : '-',
            totalSub: skipped > 0 ? `${skipped} skipped` : `${fileCount} test${fileCount !== 1 ? 's' : ''}`,
                    durationSub: formatOverviewRelativeTime(suiteRunStartedAt),
        };
    }, [leafReportsById, leafRunStateById, suiteRunState, suiteRunDurationMs, suiteRunStartedAt, mode, loadRunSummary]);

    const tree = (
        <SuiteTestTree
            ref={suiteTreeRef}
            groups={groups}
            hierarchyByEntryId={hierarchyByEntryId}
            missingFiles={effectiveMissingFiles}
            statusIconFor={statusIconFor}
            reportsById={leafReportsById}
            runStateById={leafRunStateById}
            duplicateServerIds={duplicateServerIds}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onAllCollapsedChange={setAllTreeCollapsed}
            onRunTargets={onRunTargets}
            onRunTargetsInCore={onRunTargetsInCore}
        />
    );

    return (
        <div className="panel-page">
            <div className="run-action-bar">
                <RunStopToggle
                    preparing={suiteRunState === 'pending'}
                    running={suiteRunState === 'running'}
                    onRun={onRunSuite}
                    onStop={onStopSuite}
                    runLabel={runLabel}
                    preparingLabel="Starting…"
                    stopLabel={stopLabel}
                    disabled={!canRun}
                    runTitle={!canRun ? (mode === 'loadtest' ? 'No test file to run' : 'No suite files to run') : runLabel}
                    runContextMenuItems={canRun ? [runInCoreMenuItem(onRunSuiteInCore)] : undefined}
                />
                <HideWhenYamlError>
                    <ExportReportButton disabled={suiteExportDisabled} onExport={handleExportReport} />
                </HideWhenYamlError>
            </div>
        <div className="panel-scroll">
            <div className="test-flow-tree">
                {noItems ? <div className="muted">{mode === 'loadtest' ? 'No test file found under `test:`' : 'No suite items found under `items:`'}</div> : (
                    <>
                        {mode === 'loadtest'
                            ? <>
                                <LoadOverviewBoxes load={loadRunSummary} config={loadConfig} duration={suiteRunDurationMs != null ? formatDuration(suiteRunDurationMs) : undefined} isRunning={suiteRunState === 'running'} />
                                <LoadMetricsOverview
                                    load={loadRunSummary}
                                    startedAt={loadRunSummary?.config?.started_at ?? suiteRunStartedAt ?? undefined}
                                    endedAt={loadRunSummary?.config?.finished_at ?? (suiteRunState !== 'running' && suiteRunStartedAt != null && suiteRunDurationMs != null ? suiteRunStartedAt + suiteRunDurationMs : undefined)}
                                />
                            </>
                            : overviewStats && <OverviewBoxes stats={overviewStats} />}
                        {loadConfig && (
                            <>
                                <div className="label is-field">Load</div>
                                <div className="meta-block">
                                    {mode === 'loadtest' && groups[0]?.entries[0]?.path && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-beaker meta-icon" aria-hidden />
                                            <span>Test: </span>
                                            <span
                                                title="Ctrl/Cmd+click to open test file"
                                                className="link-path"
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
                                        <div className="meta-row">
                                            <span className="codicon codicon-dashboard meta-icon" aria-hidden />
                                            <span>Threads: <code>{loadConfig.threads}</code></span>
                                        </div>
                                    )}
                                    {loadConfig.repeat != null && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-sync meta-icon" aria-hidden />
                                            <span>Repeat: <code>{String(loadConfig.repeat)}</code></span>
                                        </div>
                                    )}
                                    {loadConfig.rampup && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-graph-line meta-icon" aria-hidden />
                                            <span>Ramp-up: <code>{loadConfig.rampup}</code></span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {environment && (
                            <>
                                <div className="label is-field">Environment</div>
                                <div className="meta-block">
                                    {environment.preset && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-symbol-namespace meta-icon" aria-hidden />
                                            <span>Preset: <code>{environment.preset}</code></span>
                                        </div>
                                    )}
                                    {environment.file && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-file meta-icon" aria-hidden />
                                            <span>File: <code>{environment.file}</code></span>
                                        </div>
                                    )}
                                    {environment.variables && Object.keys(environment.variables).length > 0 && (
                                        <div>
                                            <div className="meta-row">
                                                <span className="codicon codicon-symbol-variable meta-icon" aria-hidden />
                                                <span>Variables:</span>
                                            </div>
                                            <div className="meta-kv">
                                                {Object.entries(environment.variables).map(([key, val]) => (
                                                    <div key={key} className="meta-kv-line">
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
                                <div className="label is-field">Servers</div>
                                <div className="meta-block">
                                    {servers.map((s, i) => {
                                        const name = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
                                        return (
                                            <div key={i} className="meta-row">
                                                <span className="codicon codicon-server-environment meta-icon" aria-hidden />
                                                <span
                                                    className={isDuplicateSuiteServerPath(s, duplicateServerPathKeys) ? 'mmt-line-error' : undefined}
                                                    title={isDuplicateSuiteServerPath(s, duplicateServerPathKeys) ? 'This mock server is listed more than once in this suite' : s}
                                                >
                                                    {name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        {(tagFilter.only.length > 0 || tagFilter.skip.length > 0) && (
                            <>
                                <div className="label is-field">Filter</div>
                                <div className="meta-block">
                                    {tagFilter.only.length > 0 && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-filter meta-icon" aria-hidden />
                                            <span>Only: <code>{tagFilter.only.join(', ')}</code></span>
                                        </div>
                                    )}
                                    {tagFilter.skip.length > 0 && (
                                        <div className="meta-row">
                                            <span className="codicon codicon-skip meta-icon" aria-hidden />
                                            <span>Skip: <code>{tagFilter.skip.join(', ')}</code></span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        {suiteExports.length > 0 && (
                            <>
                                <div className="label is-field">Exports</div>
                                <div className="meta-block">
                                    {suiteExports.map((ex, i) => (
                                        <div key={i} className="meta-row">
                                            <span className="codicon codicon-export meta-icon" aria-hidden />
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
                                <div className="report-section-header">
                                    <div className="label">Tests</div>
                                    <div className="report-section-header-actions">
                                        <ReportStatusFilterButton
                                            value={statusFilter}
                                            onChange={setStatusFilter}
                                            disabled={Object.keys(leafRunStateById).length === 0}
                                        />
                                        <ReportExpandCollapseButton
                                            allCollapsed={allTreeCollapsed}
                                            onExpandAll={() => suiteTreeRef.current?.expandAll()}
                                            onCollapseAll={() => suiteTreeRef.current?.collapseAll()}
                                        />
                                    </div>
                                </div>
                                {tree}
                            </>
                        )}
                    </>
                )}
            </div>
            </div>
        </div>
    );
};

export default SuiteTest;
