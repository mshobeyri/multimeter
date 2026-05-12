import React from 'react';

interface FlowchartButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Toolbar button placed next to ExportReportButton. Mirrors the existing
 * action-button styling used in test/suite headers.
 */
const FlowchartButton: React.FC<FlowchartButtonProps> = ({ disabled, onClick }) => {
  return (
    <button
      type="button"
      className="button-icon"
      disabled={disabled}
      onClick={onClick}
      title="Open flow chart"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span className="codicon codicon-type-hierarchy-sub" aria-hidden />
      Flow chart
    </button>
  );
};

export default FlowchartButton;
