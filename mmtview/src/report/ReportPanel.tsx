import React, { useCallback, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { formatDuration } from 'mmt-core/CommonData';
import { parseReportMmt } from 'mmt-core/reportParser';
import { formatReportRelativeTime } from 'mmt-core/reportFormat';
import type { CollectedResults, TestRunResult } from 'mmt-core/reportCollector';
import {
  buildReportTree,
  isSuiteOnlyRun,
  visibleReportSteps,
  type ReportTreeNode,
} from 'mmt-core/reportTree';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import type { StepStatus } from '../shared/types';
import OverviewBoxes from '../shared/OverviewBoxes';
import { statusIconFor } from '../shared/Common';
import LoadTestReport, { LoadMetricsOverview } from '../loadtest/LoadTestReport';
import PanelRunHeader from '../components/PanelRunHeader';
import { TreeChevron } from '../components/TreeChevron';
import { StatusGlyph, SuiteKindIcon } from '../components/StatusGlyph';
import ReportStatusFilterButton from '../shared/ReportStatusFilterButton';
import ReportCollapseButton from '../shared/ReportCollapseButton';
import ReportEmptyFilterPlaceholder from '../shared/ReportEmptyFilterPlaceholder';
import {
  ReportStatusFilter,
  emptyReportFilterMessage,
  stepMatchesReportFilter,
} from '../shared/reportStatusFilter';
import {
  fileLabelTitle,
  handleFileLabelActivate,
  isOpenFileModifier,
} from '../shared/treeLabelClick';
import { openRelativeFile } from '../vsAPI';

interface ReportPanelProps {
  content: string;
}

function mapToStepReports(run: TestRunResult): StepReportItem[] {
  return run.steps.map(step => ({
    stepIndex: step.stepIndex,
    stepType: step.stepType,
    status: step.status as StepStatus,
    title: step.title,
    details: step.details,
    expects: (step.expects || []).map(e => ({ ...e, status: e.status as StepStatus })),
    timestamp: step.timestamp,
    cached: step.cached === true ? true : undefined,
  }));
}

function runStateFromResult(run: TestRunResult): StepStatus {
  if (run.result === 'passed' || run.result === 'failed' || run.result === 'skipped' || run.result === 'cancelled') {
    return run.result;
  }
  return 'failed';
}

function nodeKey(node: ReportTreeNode): string {
  return node.run.id || node.run.runId || `run-${node.index}`;
}

function filterReportTree(nodes: ReportTreeNode[], filter: ReportStatusFilter): ReportTreeNode[] {
  if (filter === 'all') {
    return nodes;
  }
  const out: ReportTreeNode[] = [];
  for (const node of nodes) {
    const children = filterReportTree(node.children, filter);
    const selfMatch = stepMatchesReportFilter(runStateFromResult(node.run), filter);
    if (selfMatch || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}

function collectExpandableKeys(nodes: ReportTreeNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    const steps = visibleReportSteps(node.run);
    const hasBody = node.children.length > 0 || (steps.length > 0 && !isSuiteOnlyRun(node.run));
    if (hasBody) {
      keys.push(nodeKey(node));
    }
    keys.push(...collectExpandableKeys(node.children));
  }
  return keys;
}

function formatOverviewDateTime(value: number | string | undefined): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString();
}

function formatOverviewRelativeTime(value: number | string | undefined): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return formatReportRelativeTime(value);
}

function capitalizeLabel(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function runBadgeLabel(run: TestRunResult, state: StepStatus): string {
  const steps = visibleReportSteps(run);
  const failedCount = steps.filter(s => s.status === 'failed').length;
  const passedCount = steps.filter(s => s.status === 'passed').length;
  if (state === 'skipped') {
    return 'Skipped';
  }
  if (isSuiteOnlyRun(run) && steps.length === 0) {
    return capitalizeLabel(state);
  }
  if (failedCount > 0) {
    return `${failedCount}/${steps.length} Failed`;
  }
  if (steps.length > 0) {
    return `${passedCount} Passed`;
  }
  return capitalizeLabel(state);
}

type ReportTreeRowProps = {
  node: ReportTreeNode;
  depth: number;
  expandedById: Record<string, boolean>;
  onToggle: (id: string) => void;
};

const ReportTreeRow: React.FC<ReportTreeRowProps> = ({
  node,
  depth,
  expandedById,
  onToggle,
}) => {
  const run = node.run;
  const key = nodeKey(node);
  const state = runStateFromResult(run);
  const statusIcon = statusIconFor(state);
  const name = run.displayName || run.filePath || `Test ${node.index + 1}`;
  const filePath = typeof run.filePath === 'string' ? run.filePath.trim() : '';
  const canOpen = filePath.length > 0;
  const reports = mapToStepReports(run);
  const isSuite = run.docType === 'suite' || isSuiteOnlyRun(run);
  const hasChildren = node.children.length > 0;
  const hasSteps = reports.length > 0 && !isSuiteOnlyRun(run);
  const canExpand = hasChildren || hasSteps;
  const isExpanded = expandedById[key] === true;
  const kind = isSuite ? 'suite' : 'test';
  const marginLeft = depth > 0 ? depth * 16 : 0;
  const labelInteractive = canExpand || canOpen;
  const labelTitle = canOpen ? fileLabelTitle(filePath) : name;

  const activateLabel = (event: React.MouseEvent | React.KeyboardEvent, openFile: boolean) => {
    if (openFile && canOpen) {
      handleFileLabelActivate({
        event,
        path: filePath,
        openFile: true,
        toggleExpanded: undefined,
        openRelativeFile,
      });
      return;
    }
    if (!canExpand) {
      return;
    }
    if (!('key' in event)) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        return;
      }
    }
    onToggle(key);
  };

  return (
    <div style={marginLeft > 0 ? { marginLeft } : undefined}>
      <div className="tree-view-box tree-view-box-row">
        <div className="tree-view-box-row-arrow">
          {canExpand ? (
            <button
              type="button"
              className="action-button"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              title={isExpanded ? 'Collapse' : 'Expand'}
              onClick={() => onToggle(key)}
            >
              <TreeChevron open={isExpanded} muted />
            </button>
          ) : (
            <span className="tree-arrow-spacer" aria-hidden />
          )}
        </div>
        <div className="tree-view-box-row-main">
          <div
            className={`tree-view-box-row-label${labelInteractive ? ' tree-view-box-row-label-link' : ''}`}
            title={labelTitle}
            role={labelInteractive ? 'button' : undefined}
            tabIndex={labelInteractive ? 0 : undefined}
            onClick={(e) => activateLabel(e, isOpenFileModifier(e))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                activateLabel(e, isOpenFileModifier(e));
              }
            }}
          >
            <StatusGlyph
              icon={statusIcon.icon}
              color={statusIcon.color}
              title={statusIcon.title}
            />
            <SuiteKindIcon kind={kind} />
            <span className="ellipsis is-clip">{name}</span>
          </div>
          <span className="report-tree-badge">{runBadgeLabel(run, state)}</span>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ReportTreeRow
              key={nodeKey(child)}
              node={child}
              depth={depth + 1}
              expandedById={expandedById}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
      {isExpanded && hasSteps && (
        <div
          className="report-selectable pad-b-8"
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <TestStepReportPanel
            isExpanded={true}
            stepReports={reports}
            runState={state}
            showHeader={false}
            showTimestamps={false}
          />
        </div>
      )}
    </div>
  );
};

const ReportPanel: React.FC<ReportPanelProps> = ({ content }) => {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');

  const parsed = useMemo((): { results: CollectedResults | null; error: string | null } => {
    try {
      const doc = parseYaml(content);
      if (!doc || typeof doc !== 'object' || (doc as any).type !== 'report') {
        return { results: null, error: 'Not a valid MMT report file (type: report expected)' };
      }
      const results = parseReportMmt(doc as Record<string, any>);
      return { results, error: null };
    } catch (e: any) {
      return { results: null, error: e?.message || 'Failed to parse report' };
    }
  }, [content]);

  const tree = useMemo(() => {
    if (!parsed.results || parsed.results.type === 'loadtest') {
      return [] as ReportTreeNode[];
    }
    return buildReportTree(parsed.results.testRuns);
  }, [parsed.results]);

  const filteredTree = useMemo(
    () => filterReportTree(tree, statusFilter),
    [tree, statusFilter],
  );

  const handleToggle = useCallback((id: string) => {
    setExpandedById(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedById({});
  }, []);

  if (parsed.error) {
    return (
      <div className="panel-error">
        {parsed.error}
      </div>
    );
  }

  if (!parsed.results) {
    return null;
  }

  const { results } = parsed;
  const isLoadReport = results.type === 'loadtest' && !!results.load;
  const totalTests = results.testRuns.reduce((s, r) => s + visibleReportSteps(r).length, 0);
  const totalPassed = results.testRuns.reduce((s, r) => s + visibleReportSteps(r).filter(st => st.status === 'passed').length, 0);
  const totalFailed = results.testRuns.reduce((s, r) => s + visibleReportSteps(r).filter(st => st.status === 'failed').length, 0);
  const totalSkipped = results.testRuns.filter(r => r.result === 'skipped').length;
  const totalSuites = results.testRuns.filter(r => r.docType !== 'group').length;
  const suiteName = results.suiteRun?.suiteTitle || results.suiteRun?.suitePath || 'Test Report';
  const duration = results.suiteRun?.durationMs != null
    ? formatDuration(results.suiteRun.durationMs)
    : undefined;
  const loadSummary = results.load?.summary;
  const loadFailedRate = loadSummary?.requests ? (((loadSummary.failures ?? 0) / loadSummary.requests) * 100).toFixed(1) : '0.0';
  const failedRate = totalTests > 0 ? ((totalFailed / totalTests) * 100).toFixed(1) : '0.0';
  const startedAtText = formatOverviewDateTime(results.suiteRun?.startedAt || results.load?.config?.started_at);
  const endedAtText = formatOverviewDateTime(results.suiteRun?.finishedAt || results.load?.config?.finished_at);
  const startedAtRelative = formatOverviewRelativeTime(results.suiteRun?.startedAt || results.load?.config?.started_at);
  const overviewStats = isLoadReport ? {
    passed: loadSummary?.successes ?? 0,
    failed: loadSummary?.failures ?? 0,
    total: loadSummary?.requests ?? loadSummary?.iterations ?? 0,
    duration,
    failedSub: `${loadFailedRate}%`,
    totalSub: `${loadSummary?.iterations ?? 0} iteration${loadSummary?.iterations === 1 ? '' : 's'}`,
    durationSub: startedAtRelative,
  } : {
    passed: totalPassed,
    failed: totalFailed,
    total: totalTests,
    duration,
    failedSub: `${failedRate}%`,
    totalSub: `${totalSuites} test${totalSuites !== 1 ? 's' : ''}`,
    durationSub: startedAtRelative,
  };
  const overviewDetails = ([
    ['Started at', startedAtText],
    ['Ended at', endedAtText],
    ['Duration', duration],
    ['Branch', results.suiteRun?.gitBranch],
    ['Commit', results.suiteRun?.gitCommit],
    ['Tag', results.suiteRun?.gitTag],
    ['Passed', String(totalPassed)],
    ['Failed', String(totalFailed)],
    ['Skipped', String(totalSkipped)],
    ['Total checks', String(totalTests)],
    ['Tests', String(totalSuites)],
  ] as Array<[string, string | undefined]>).filter(([, value]) => value !== undefined && value !== '');
  const headerSubtitle = isLoadReport ? 'Load report' : 'Functional report';
  const hasAnyExpandable = collectExpandableKeys(filteredTree).length > 0;
  const filterEmpty = !isLoadReport && statusFilter !== 'all' && filteredTree.length === 0;

  return (
    <div className="panel">
      <div className="panel-box is-fill">
        <PanelRunHeader
          icon="file-text"
          iconTitle={suiteName}
          title={
            <>
              <span className="panel-run-header-title-text">{suiteName}</span>
              <span className="panel-run-header-subtitle">({headerSubtitle})</span>
            </>
          }
        />

        <div className="panel-view-stack">
          <div className="panel-view-fixed">
            <OverviewBoxes stats={overviewStats} />
            {isLoadReport && results.load && (
              <LoadMetricsOverview
                load={results.load}
                startedAt={results.suiteRun?.startedAt || results.load?.config?.started_at}
                endedAt={results.suiteRun?.finishedAt || results.load?.config?.finished_at}
              />
            )}
            {overviewDetails.length > 0 && !isLoadReport && (
              <div className="stat-card is-nudge">
                <div className="stat-grid is-wide">
                  {overviewDetails.map(([label, value]) => (
                    <div key={label}>
                      <div className="stat-label">{label}</div>
                      <div className="stat-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isLoadReport && results.load ? (
            <div className="panel-scroll">
              <LoadTestReport load={results.load} />
            </div>
          ) : (
            <>
              <div className="report-section-header">
                <div className="label">Report</div>
                <div className="report-section-header-actions">
                  <ReportStatusFilterButton
                    value={statusFilter}
                    onChange={setStatusFilter}
                    disabled={tree.length === 0}
                  />
                  <ReportCollapseButton
                    onCollapseAll={handleCollapseAll}
                    disabled={!hasAnyExpandable}
                  />
                </div>
              </div>
              <div className="panel-scroll is-x-clip">
                <div className="test-flow-tree">
                  {filterEmpty ? (
                    <ReportEmptyFilterPlaceholder
                      filter={statusFilter}
                      onShowAll={() => setStatusFilter('all')}
                    />
                  ) : filteredTree.length === 0 ? (
                    <div className="muted italic">
                      {emptyReportFilterMessage('all')}
                    </div>
                  ) : (
                    filteredTree.map((node) => (
                      <ReportTreeRow
                        key={nodeKey(node)}
                        node={node}
                        depth={0}
                        expandedById={expandedById}
                        onToggle={handleToggle}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportPanel;
