import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [boxCols, setBoxCols] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) { return; }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.offsetWidth;
      if (w < 340) {
        setBoxCols(1);
      } else if (w < 560) {
        setBoxCols(2);
      } else {
        setBoxCols(4);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  const totalSuites = results.testRuns.length;
  const suiteName = results.suiteRun?.suitePath || 'Test Report';
  const duration = results.suiteRun?.durationMs != null
    ? (results.suiteRun.durationMs / 1000).toFixed(3) + 's'
    : undefined;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) + '%' : '-';

  return (
    <div ref={containerRef} style={{ width: 'calc(100% - 16px)', padding: '0 4px', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <div>{suiteName}</div>
        <ExportReportButton disabled={false} onExport={handleExportReport} />
      </div>

      {/* Overview section */}
      <div className="label" style={{ marginBottom: 6 }}>Overview</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${boxCols}, 1fr)`,
        gap: 8,
        marginBottom: 14,
      }}>
        {/* Passed */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
          border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
          minWidth: 0,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(63, 185, 80, 0.15)',
            color: 'var(--vscode-testing-iconPassed, #3fb950)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Passed</span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{totalPassed}</span>
            <span style={{ fontSize: 9, color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{passRate} pass rate</span>
          </div>
        </div>

        {/* Failed */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
          border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
          minWidth: 0,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(248, 81, 73, 0.15)',
            color: 'var(--vscode-testing-iconFailed, #f85149)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Failed</span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{totalFailed}</span>
            <span style={{ fontSize: 9, color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{totalSuites} suite{totalSuites !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Total */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
          border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
          minWidth: 0,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(88, 166, 255, 0.15)',
            color: 'var(--vscode-textLink-foreground, #58a6ff)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line><line x1="8" y1="17" x2="12" y2="17"></line></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Total Tests</span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{totalTests}</span>
            <span style={{ fontSize: 9, color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{totalTests} checks</span>
          </div>
        </div>

        {/* Duration */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
          border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
          minWidth: 0,
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(139, 148, 158, 0.15)',
            color: 'var(--vscode-descriptionForeground, #8b949e)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 }}>Duration</span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{duration || '-'}</span>
            <span style={{ fontSize: 9, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{totalSuites} file{totalSuites !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Report section */}
      <div className="label" style={{ marginBottom: 10 }}>Report</div>

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
