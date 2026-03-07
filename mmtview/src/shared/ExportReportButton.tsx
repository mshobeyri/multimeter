import React, { useCallback, useRef } from 'react';

export type ReportFormat = 'junit' | 'mmt' | 'html' | 'md';

interface ExportReportButtonProps {
  disabled?: boolean;
  onExport: (format: ReportFormat) => void;
}

const ExportReportButton: React.FC<ExportReportButtonProps> = ({ disabled, onExport }) => {
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const format = e.target.value as ReportFormat;
    if (format) {
      onExport(format);
    }
    // Reset to placeholder so the same format can be picked again
    if (selectRef.current) {
      selectRef.current.value = '';
    }
  }, [onExport]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        className="button-icon"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 12px',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          pointerEvents: 'none',
          background: 'var(--vscode-button-background, #0e639c)',
          color: 'var(--vscode-button-foreground, #ffffff)',
          border: '1px solid var(--vscode-button-border, #3c3c3c)',
          borderRadius: 2,
          fontSize: 'var(--vscode-font-size, 13px)',
          fontFamily: 'var(--vscode-font-family, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif)',
        }}
      >
        <span className="codicon codicon-export" aria-hidden />
        Export
      </div>
      <select
        ref={selectRef}
        disabled={disabled}
        onChange={handleChange}
        defaultValue=""
        title="Export test report"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          height: '100%',
        }}
      >
      <option value="junit">JUnit XML</option>
      <option value="mmt">MMT Report</option>
      <option value="html">HTML</option>
      <option value="md">Markdown</option>
    </select>
    </div>
  );
};

export default ExportReportButton;
