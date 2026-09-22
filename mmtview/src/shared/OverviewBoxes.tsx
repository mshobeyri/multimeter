import React, { useEffect, useRef, useState } from 'react';

export interface OverviewStats {
  passed: number;
  failed: number;
  total: number;
  /** e.g. "0.123s" */
  duration?: string;
  /** Sub-label under the failed count, e.g. "25%" */
  failedSub?: string;
  /** Sub-label under the total count, e.g. "5 checks" */
  totalSub?: string;
  /** Sub-label under the duration, e.g. "1 file" */
  durationSub?: string;
}

const OverviewBoxes: React.FC<{ stats: OverviewStats }> = ({ stats }) => {
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

  const { passed, failed, total, duration, failedSub, totalSub, durationSub } = stats;
  const executed = passed + failed;
  const passRate = executed > 0 ? ((passed / executed) * 100).toFixed(1) + '%' : '-';
  const failRate = executed > 0 ? ((failed / executed) * 100).toFixed(1) + '%' : '-';

  return (
    <div ref={containerRef}>
      <div className="label is-field">Overview</div>
      <div
        className="stat-grid"
        style={{ gridTemplateColumns: `repeat(${boxCols}, 1fr)` }}
      >
        {/* Passed */}
        <div className="overview-box">
          <div
            className="overview-icon"
            style={{
              background: 'rgba(63, 185, 80, 0.15)',
              color: 'var(--vscode-testing-iconPassed, #3fb950)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div className="overview-copy">
            <span className="overview-label">Passed</span>
            <span className="overview-value" style={{ color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{passed}</span>
            <span className="overview-sub" style={{ color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{passRate}</span>
          </div>
        </div>

        {/* Failed */}
        <div className="overview-box">
          <div
            className="overview-icon"
            style={{
              background: 'rgba(248, 81, 73, 0.15)',
              color: 'var(--vscode-testing-iconFailed, #f85149)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <div className="overview-copy">
            <span className="overview-label">Failed</span>
            <span className="overview-value" style={{ color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{failed}</span>
            <span className="overview-sub" style={{ color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{failedSub || failRate}</span>
          </div>
        </div>

        {/* Total */}
        <div className="overview-box">
          <div
            className="overview-icon"
            style={{
              background: 'rgba(88, 166, 255, 0.15)',
              color: 'var(--vscode-textLink-foreground, #58a6ff)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line><line x1="8" y1="17" x2="12" y2="17"></line></svg>
          </div>
          <div className="overview-copy">
            <span className="overview-label">Total</span>
            <span className="overview-value" style={{ color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{total}</span>
            {totalSub && <span className="overview-sub" style={{ color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{totalSub}</span>}
          </div>
        </div>

        {/* Duration */}
        <div className="overview-box">
          <div
            className="overview-icon"
            style={{
              background: 'rgba(139, 148, 158, 0.15)',
              color: 'var(--vscode-descriptionForeground, #8b949e)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="overview-copy">
            <span className="overview-label">Duration</span>
            <span className="overview-value" style={{ color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{duration || '-'}</span>
            {durationSub && <span className="overview-sub" style={{ color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{durationSub}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewBoxes;
