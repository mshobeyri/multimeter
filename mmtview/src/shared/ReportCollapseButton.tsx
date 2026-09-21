import React from 'react';

interface ReportCollapseButtonProps {
  onCollapseAll: () => void;
  disabled?: boolean;
  title?: string;
}

/** Collapse-all control for report and suite tree headers. */
const ReportCollapseButton: React.FC<ReportCollapseButtonProps> = ({
  onCollapseAll,
  disabled,
  title = 'Collapse all',
}) => (
  <button
    type="button"
    className="action-button report-header-more-btn"
    disabled={disabled}
    title={title}
    aria-label={title}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) {
        onCollapseAll();
      }
    }}
  >
    <span className={`codicon codicon-collapse-all report-header-more-icon${disabled ? ' is-disabled' : ''}`} />
  </button>
);

export default ReportCollapseButton;
