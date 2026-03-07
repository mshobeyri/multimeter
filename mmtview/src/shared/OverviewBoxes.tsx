import React, { useEffect, useRef, useState } from 'react';

export interface OverviewStats {
  passed: number;
  failed: number;
  total: number;
  /** e.g. "0.123s" */
  duration?: string;
  /** Sub-label under the failed count, e.g. "2 suites" */
  failedSub?: string;
  /** Sub-label under the total count, e.g. "5 checks" */
  totalSub?: string;
  /** Sub-label under the duration, e.g. "1 file" */
  durationSub?: string;
}

const boxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--vscode-editor-background, rgba(40,40,40,0.8))',
  border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))',
  minWidth: 0,
};

const iconBoxBase: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  opacity: 0.6,
};

const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  lineHeight: 1.2,
};

const subStyle: React.CSSProperties = {
  fontSize: 9,
};

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
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '-';

  return (
    <div ref={containerRef}>
      <div className="label" style={{ marginBottom: 6 }}>Overview</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${boxCols}, 1fr)`,
        gap: 8,
        marginBottom: 14,
      }}>
        {/* Passed */}
        <div style={boxStyle}>
          <div style={{
            ...iconBoxBase,
            background: 'rgba(63, 185, 80, 0.15)',
            color: 'var(--vscode-testing-iconPassed, #3fb950)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={labelStyle}>Passed</span>
            <span style={{ ...valueStyle, color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{passed}</span>
            <span style={{ ...subStyle, color: 'var(--vscode-testing-iconPassed, #3fb950)' }}>{passRate} pass rate</span>
          </div>
        </div>

        {/* Failed */}
        <div style={boxStyle}>
          <div style={{
            ...iconBoxBase,
            background: 'rgba(248, 81, 73, 0.15)',
            color: 'var(--vscode-testing-iconFailed, #f85149)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={labelStyle}>Failed</span>
            <span style={{ ...valueStyle, color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{failed}</span>
            {failedSub && <span style={{ ...subStyle, color: 'var(--vscode-testing-iconFailed, #f85149)' }}>{failedSub}</span>}
          </div>
        </div>

        {/* Total */}
        <div style={boxStyle}>
          <div style={{
            ...iconBoxBase,
            background: 'rgba(88, 166, 255, 0.15)',
            color: 'var(--vscode-textLink-foreground, #58a6ff)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="14" y2="13"></line><line x1="8" y1="17" x2="12" y2="17"></line></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={labelStyle}>Total</span>
            <span style={{ ...valueStyle, color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{total}</span>
            {totalSub && <span style={{ ...subStyle, color: 'var(--vscode-textLink-foreground, #58a6ff)' }}>{totalSub}</span>}
          </div>
        </div>

        {/* Duration */}
        <div style={boxStyle}>
          <div style={{
            ...iconBoxBase,
            background: 'rgba(139, 148, 158, 0.15)',
            color: 'var(--vscode-descriptionForeground, #8b949e)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={labelStyle}>Duration</span>
            <span style={{ ...valueStyle, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{duration || '-'}</span>
            {durationSub && <span style={{ ...subStyle, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{durationSub}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewBoxes;
