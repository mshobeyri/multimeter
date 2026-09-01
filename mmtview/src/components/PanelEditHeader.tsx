import React, { useContext } from 'react';
import { FileContext } from '../fileContext';
import YamlErrorWarning from '../api/YamlErrorWarning';

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
  const { yamlErrors } = useContext(FileContext);
  const hasYamlErrors = (yamlErrors?.length ?? 0) > 0;

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
        {hasYamlErrors && (
          <div className="api-edit-header-row-status">
            <YamlErrorWarning />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
