import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import TreeRunButton from '../../components/TreeRunButton';

export type SuiteTestGroupItemData = { type: 'group' | 'root' | 'import-group'; label: string };

interface SuiteTestGroupItemProps {
  item: TreeItem<any>;
  context: any;
  arrow: React.ReactNode;
  children: React.ReactNode;
  getGroupStatus: (itemId: string) => StepStatus;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
  canShowStatusIcon?: boolean;
  showRunButton?: boolean;
  onRun?: () => void;
  /** Logs-only run (opens output channel via menu helper). */
  onRunInCore?: () => void;
  runButtonTitle?: string;
  runDisabled?: boolean;
}

const SuiteTestGroupItem: React.FC<SuiteTestGroupItemProps> = ({
  item,
  context,
  arrow,
  children,
  getGroupStatus,
  statusIconFor,
  canShowStatusIcon = true,
  showRunButton = false,
  onRun,
  onRunInCore,
  runButtonTitle = 'Run',
  runDisabled = false,
}) => {
  const data = item.data as SuiteTestGroupItemData;
  if (data.type !== 'group' && data.type !== 'root' && data.type !== 'import-group') {
    return null;
  }

  const isRoot = data.type === 'root';
  const statusIcon = isRoot
    ? { icon: 'codicon-files', color: 'var(--vscode-editor-foreground, #c5c5c5)', title: 'Suite' }
    : canShowStatusIcon
      ? statusIconFor(getGroupStatus(String(item.index)))
      : null;

  return (
    <div {...context.itemContainerWithChildrenProps}>
      <div
        className="tree-view-box tree-view-box-row"
        {...context.itemContainerWithoutChildrenProps}
      >
        <div className="tree-view-box-row-arrow">{arrow}</div>
        <div className="tree-view-box-row-main">
          <div
            className="tree-view-box-row-label tree-view-box-row-label-link"
            title="Click to expand"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              context?.toggleExpandedState?.();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                context?.toggleExpandedState?.();
              }
            }}
          >
            {statusIcon && (
              <span className={`codicon ${statusIcon.icon}`} aria-hidden title={statusIcon.title} style={{ color: statusIcon.color }} />
            )}
            {data.type === 'group' || data.type === 'import-group' ? (
              <span className="codicon codicon-layers" aria-hidden title="Group" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
            ) : (
              <span className="codicon codicon-package" aria-hidden title="Suite" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
            )}
            <span>{data.label}</span>
          </div>
          {showRunButton && (
            <TreeRunButton
              onRun={onRun}
              onRunInCore={onRunInCore}
              title={runButtonTitle}
              disabled={runDisabled}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteTestGroupItem;
