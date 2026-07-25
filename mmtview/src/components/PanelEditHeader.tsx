import React from 'react';

export type PanelEditHeaderProps = {
  title: React.ReactNode;
  onBack: () => void;
  backTitle?: string;
  /** Extra controls on the title row (e.g. flowchart refresh). */
  trailing?: React.ReactNode;
  /** Typically a TabBar under the title row. */
  children?: React.ReactNode;
};

/**
 * Edit / secondary page header: back + title (+ optional trailing / tabs).
 */
export default function PanelEditHeader({
  title,
  onBack,
  backTitle = 'Back',
  trailing,
  children,
}: PanelEditHeaderProps) {
  return (
    <div className="api-edit-header">
      <div className="api-edit-header-row">
        <button
          className="action-button"
          onClick={onBack}
          title={backTitle}
          type="button"
        >
          <span className="codicon codicon-arrow-left" aria-hidden />
        </button>
        <div className="api-edit-title">{title}</div>
        {trailing}
      </div>
      {children}
    </div>
  );
}
