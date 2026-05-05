import React, { useCallback, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { formatDuration } from 'mmt-core/CommonData';
import { parseReportMmt } from 'mmt-core/reportParser';
import type { CollectedResults, TestRunResult } from 'mmt-core/reportCollector';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import type { StepStatus } from '../shared/types';
import ExportReportButton, { ReportFormat } from '../shared/ExportReportButton';
import OverviewBoxes from '../shared/OverviewBoxes';
import { statusIconFor } from '../shared/Common';
import LoadTestReport from '../loadtest/LoadTestReport';

interface ReportPanelProps {
  content: string;
  setContent: (c: string) => void;
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
  }));
}

function runStateFromResult(run: TestRunResult): 'passed' | 'failed' {
  return run.result === 'passed' ? 'passed' : 'failed';
}

const ReportPanel: React.FC<ReportPanelProps> = ({ content }) => {
  const [expandedSuites, setExpandedSuites] = useState<Record<number, boolean>>({});

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

  const handleExportReport = useCallback((format: ReportFormat) => {
    if (!parsed.results) {
      return;
    }
    const runs = parsed.results.testRuns;
    const leafReportsById: Record<string, StepReportItem[]> = {};
    const leafRunStateById: Record<string, StepStatus> = {};
    runs.forEach((run, i) => {
      const key = run.id || run.runId || `run-${i}`;
      leafReportsById[key] = mapToStepReports(run);
      leafRunStateById[key] = runStateFromResult(run);
    });

    window.vscode?.postMessage({
      command: 'exportReport',
      format,
      data: {
        type: parsed.results.type === 'loadtest' ? 'loadtest' : parsed.results.type === 'suite' ? 'suite' : 'test',
        leafReportsById,
        leafRunStateById,
        stepStatuses: leafRunStateById,
        suiteRunState: parsed.results.suiteRun?.success ? 'passed' : 'failed',
        stepReports: runs.length === 1 ? mapToStepReports(runs[0]) : [],
        runState: runs.length === 1 ? runStateFromResult(runs[0]) : 'passed',
        outputs: {},
        load: parsed.results.load,
      },
    });
  }, [parsed.results]);

  if (parsed.error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: 'var(--vscode-errorForeground)', marginBottom: 8 }}>
          {parsed.error}
        </div>
      </div>
    );
  }

  if (!parsed.results) {
    return null;
  }

  const { results } = parsed;
  const isLoadReport = results.type === 'loadtest' && !!results.load;
  const totalTests = results.testRuns.reduce((s, r) => s + r.steps.length, 0);
  const totalPassed = results.testRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'passed').length, 0);
  const totalFailed = results.testRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'failed').length, 0);
  const totalSuites = results.testRuns.length;
  const suiteName = results.suiteRun?.suitePath || 'Test Report';
  const duration = results.suiteRun?.durationMs != null
    ? formatDuration(results.suiteRun.durationMs)
    : undefined;
  const loadSummary = results.load?.summary;
  const overviewStats = isLoadReport ? {
    passed: loadSummary?.successes ?? 0,
    failed: loadSummary?.failures ?? 0,
    total: loadSummary?.requests ?? loadSummary?.iterations ?? 0,
    duration,
    failedSub: 'load failures',
    totalSub: `${loadSummary?.iterations ?? 0} iteration${loadSummary?.iterations === 1 ? '' : 's'}`,
    durationSub: 'load test',
  } : {
    passed: totalPassed,
    failed: totalFailed,
    total: totalTests,
    duration,
    failedSub: `${totalSuites} suite${totalSuites !== 1 ? 's' : ''}`,
    totalSub: `${totalTests} check${totalTests !== 1 ? 's' : ''}`,
    durationSub: `${totalSuites} file${totalSuites !== 1 ? 's' : ''}`,
  };
  const headerIcon = isLoadReport ? 'codicon-graph' : 'codicon-layers';
  const headerSubtitle = isLoadReport ? 'Load report' : 'Functional report';

  return (
    <div style={{ width: 'calc(100% - 16px)', padding: '0 4px', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="api-edit-header" style={{ marginBottom: 12 }}>
        <div className="tab-bar tab-bar-single" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="tab-button active" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={suiteName}>
            <span className={`codicon ${headerIcon}`} aria-hidden />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suiteName}</span>
            <span style={{ opacity: 0.7, fontSize: '0.85em', marginLeft: 4 }}>({headerSubtitle})</span>
          </div>
          <ExportReportButton disabled={false} onExport={handleExportReport} />
        </div>
      </div>

      <OverviewBoxes stats={overviewStats} />

      {isLoadReport && results.load && (
        <LoadTestReport load={results.load} />
      )}

      {!isLoadReport && (
        <>
          {/* Report section */}
          <div className="label" style={{ marginBottom: 10 }}>Report</div>

          {results.testRuns.map((run, i) => {
        const reports = mapToStepReports(run);
        const state = runStateFromResult(run);
        const name = run.displayName || run.filePath || `Test ${i + 1}`;
        const isExpanded = expandedSuites[i] === true;
        const statusIcon = statusIconFor(state);
        const passedCount = reports.filter(r => r.status === 'passed').length;
        const failedCount = reports.filter(r => r.status === 'failed').length;
        const isSuiteOnly = (run as any).docType === 'suite' && reports.length === 0;

        return (
          <div key={run.id || run.runId || i} style={{ marginBottom: 4 }}>
            {/* Tree item header */}
            <div
              onClick={() => {
                if (!isSuiteOnly) {
                  setExpandedSuites(prev => ({ ...prev, [i]: !isExpanded }));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 4px',
                cursor: isSuiteOnly ? 'default' : 'pointer',
                borderRadius: 4,
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {/* Expand/collapse arrow */}
              {isSuiteOnly ? (
                <span
                  className="codicon codicon-layers"
                  style={{ width: 16, opacity: 0.75 }}
                  title="Suite"
                />
              ) : (
                <span
                  className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  style={{ width: 16, opacity: 0.7 }}
                />
              )}
              {/* Status icon */}
              <span
                className={`codicon ${statusIcon.icon}`}
                style={{ color: statusIcon.color }}
                title={statusIcon.title}
              />
              {/* Test name */}
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }} title={name}>
                {name}
              </span>
              {/* Summary badge */}
              <span style={{
                fontSize: '0.85em',
                opacity: 0.7,
                whiteSpace: 'nowrap',
              }}>
                {isSuiteOnly ? state : failedCount > 0 ? `${failedCount} failed` : `${passedCount} passed`}
              </span>
            </div>

            {/* Expanded content - check/assert results */}
            {isExpanded && !isSuiteOnly && (
              <div style={{ marginLeft: 24, paddingBottom: 8 }}>
                <TestStepReportPanel
                  isExpanded={true}
                  stepReports={reports}
                  runState={state}
                  showHeader={false}
                />
              </div>
            )}
          </div>
        );
      })}

          {results.testRuns.length === 0 && (
            <div style={{ opacity: 0.7, fontStyle: 'italic' }}>
              No test results in this report.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportPanel;
