import React, { useCallback, useRef } from 'react';
import { PrimaryButtonFace } from '../components/PrimaryButton';

export type ReportFormat = 'junit' | 'mmt' | 'html' | 'md' | 'md-detailed';

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
    if (selectRef.current) {
      selectRef.current.value = '';
    }
  }, [onExport]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <PrimaryButtonFace icon="export" disabled={disabled}>
        Export
      </PrimaryButtonFace>
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
        <option value="md-detailed">Markdown (detailed)</option>
      </select>
    </div>
  );
};

export default ExportReportButton;
