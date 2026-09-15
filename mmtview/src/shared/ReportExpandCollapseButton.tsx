import React from 'react';

interface ReportExpandCollapseButtonProps {
  allCollapsed: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  disabled?: boolean;
}

/** Toggle: Collapse all while anything is expanded; Expand all when everything is collapsed. */
const ReportExpandCollapseButton: React.FC<ReportExpandCollapseButtonProps> = ({
  allCollapsed,
  onExpandAll,
  onCollapseAll,
  disabled,
}) => {
  const label = allCollapsed ? 'Expand all' : 'Collapse all';
  const icon = allCollapsed ? 'codicon-expand-all' : 'codicon-collapse-all';

  return (
    <button
      type="button"
      className="action-button report-header-more-btn"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) {
          return;
        }
        if (allCollapsed) {
          onExpandAll();
        } else {
          onCollapseAll();
        }
      }}
    >
      <span className={`codicon ${icon} report-header-more-icon${disabled ? ' is-disabled' : ''}`} />
    </button>
  );
};

export default ReportExpandCollapseButton;
