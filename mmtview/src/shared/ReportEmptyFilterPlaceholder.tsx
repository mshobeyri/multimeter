import React from 'react';
import { ReportStatusFilter, emptyReportFilterMessage } from './reportStatusFilter';

interface ReportEmptyFilterPlaceholderProps {
  filter: ReportStatusFilter;
  onShowAll: () => void;
}

/** Empty-state when Passed/Failed filter matches nothing, with a reset action. */
const ReportEmptyFilterPlaceholder: React.FC<ReportEmptyFilterPlaceholderProps> = ({
  filter,
  onShowAll,
}) => {
  return (
    <div className="report-empty-filter" role="status">
      <span
        className={`codicon ${filter === 'failed' ? 'codicon-error' : filter === 'passed' ? 'codicon-pass' : 'codicon-filter'} report-empty-filter-icon`}
        aria-hidden
      />
      <div className="report-empty-filter-message">
        {emptyReportFilterMessage(filter)}
      </div>
      <button
        type="button"
        className="report-empty-filter-link"
        onClick={onShowAll}
      >
        Show all tests
      </button>
    </div>
  );
};

export default ReportEmptyFilterPlaceholder;
