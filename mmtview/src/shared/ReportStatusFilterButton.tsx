import React, { useCallback, useRef } from 'react';
import {
  REPORT_STATUS_FILTER_OPTIONS,
  ReportStatusFilter,
  parseReportStatusFilter,
} from './reportStatusFilter';

interface ReportStatusFilterButtonProps {
  value: ReportStatusFilter;
  onChange: (next: ReportStatusFilter) => void;
  disabled?: boolean;
}

/** Ghost filter icon (no background) with an invisible select overlay. */
const ReportStatusFilterButton: React.FC<ReportStatusFilterButtonProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const active = value !== 'all';
  const label = REPORT_STATUS_FILTER_OPTIONS.find((opt) => opt.value === value)?.label || 'All';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(parseReportStatusFilter(e.target.value));
  }, [onChange]);

  return (
    <div
      className="report-status-filter"
      title={`Filter: ${label}`}
    >
      <span
        className={`codicon ${active ? 'codicon-filter-filled' : 'codicon-filter'} report-status-filter-icon${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
        aria-hidden
      />
      <select
        ref={selectRef}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        title={`Filter: ${label}`}
        aria-label="Filter by status"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          height: '100%',
        }}
      >
        {REPORT_STATUS_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

export default ReportStatusFilterButton;
