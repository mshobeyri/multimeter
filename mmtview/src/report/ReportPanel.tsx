import React, { useCallback, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { parseReportMmt } from 'mmt-core/reportParser';
import type { CollectedResults, TestRunResult } from 'mmt-core/reportCollector';
import TestStepReportPanel, { StepReportItem } from '../shared/TestStepReportPanel';
import type { StepStatus } from '../shared/types';
import ExportReportButton, { ReportFormat } from '../shared/ExportReportButton';

interface ReportPanelProps {
  content: string;
  setContent: (c: string) => void;
}

function mapToStepReports(run: TestRunResult): StepReportItem[] {
  return run.steps.map(step => ({
    stepIndex: step.stepIndex,
    stepType: step.stepType,
    status: step.status as StepStatus,
    comparison: step.comparison || '',
    title: step.title,
    details: step.details,
    actual: step.actual,
    expected: step.expected,
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
        type: parsed.results.type === 'suite' ? 'suite' : 'test',
        leafReportsById,
        leafRunStateById,
        stepStatuses: leafRunStateById,
        suiteRunState: parsed.results.suiteRun?.success ? 'passed' : 'failed',
        stepReports: runs.length === 1 ? mapToStepReports(runs[0]) : [],
        runState: runs.length === 1 ? runStateFromResult(runs[0]) : 'passed',
        outputs: {},
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
  const totalTests = results.testRuns.reduce((s, r) => s + r.steps.length, 0);
  const totalPassed = results.testRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'passed').length, 0);
  const totalFailed = results.testRuns.reduce((s, r) => s + r.steps.filter(st => st.status === 'failed').length, 0);
  const suiteName = results.suiteRun?.suitePath || 'Test Report';
  const duration = results.suiteRun?.durationMs != null
    ? (results.suiteRun.durationMs / 1000).toFixed(3) + 's'
    : undefined;

  return (
    <div style={{ width: '100%', padding: '0 4px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <div style={{ fontSize: '1.1em', fontWeight: 600, marginBottom: 4 }}>
            {suiteName}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.9em' }}>
            <span style={{ color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>
              ✓ {totalPassed} passed
            </span>
            <span style={{ color: 'var(--vscode-testing-iconFailed, #f85149)' }}>
              ✗ {totalFailed} failed
            </span>
            <span style={{ opacity: 0.7 }}>
              {totalTests} total
            </span>
            {duration && (
              <span style={{ opacity: 0.7 }}>
                {duration}
              </span>
            )}
          </div>
        </div>
        <ExportReportButton disabled={false} onExport={handleExportReport} />
      </div>

      {results.testRuns.map((run, i) => {
        const reports = mapToStepReports(run);
        const state = runStateFromResult(run);
        const name = run.displayName || run.filePath || `Test ${i + 1}`;
        const isExpanded = expandedSuites[i] !== false;

        return (
          <div key={run.id || run.runId || i} style={{ marginBottom: 8 }}>
            <TestStepReportPanel
              isExpanded={isExpanded}
              onToggleExpanded={() =>
                setExpandedSuites(prev => ({ ...prev, [i]: !isExpanded }))
              }
              stepReports={reports}
              runState={state}
              runButtonLabel={name}
              showHeader={true}
            />
          </div>
        );
      })}

      {results.testRuns.length === 0 && (
        <div style={{ opacity: 0.7, fontStyle: 'italic' }}>
          No test results in this report.
        </div>
      )}
    </div>
  );
};

export default ReportPanel;
