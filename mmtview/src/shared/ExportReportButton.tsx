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
    <select
      ref={selectRef}
      className="button-icon"
      disabled={disabled}
      onChange={handleChange}
      defaultValue=""
      title="Export test report"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        paddingRight: 8,
      }}
    >
      <option value="" disabled hidden>
        &#xeaf7; Export
      </option>
      <option value="junit">JUnit XML</option>
      <option value="mmt">MMT Report</option>
      <option value="html">HTML</option>
      <option value="md">Markdown</option>
    </select>
  );
};

export default ExportReportButton;
