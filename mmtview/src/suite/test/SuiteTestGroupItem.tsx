import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../types';

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
        className="tree-view-box"
        {...context.itemContainerWithoutChildrenProps}
        style={{ paddingTop: 10, display: 'flex' }}
      >
        <div style={{ width: 24, minWidth: 24, display: 'inline-flex', alignItems: 'flex-start' }}>{arrow}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {statusIcon && (
            <span className={`codicon ${statusIcon.icon}`} aria-hidden style={{ color: statusIcon.color }} />
          )}
          {/* Type icon: group/root/import-group */}
          {data.type === 'group' || data.type === 'import-group' ? (
            <span className="codicon codicon-layers" aria-hidden title="Group" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
          ) : (
            <span className="codicon codicon-package" aria-hidden title="Suite" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
          )}
          <span style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{data.label}</span>
          </div>
          {showRunButton && (
            <button
              className="tab-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRun?.();
              }}
              title={runButtonTitle}
              disabled={runDisabled}
              style={{ marginTop: -2, padding: 6 }}
            >
              <span className="codicon codicon-run tab-button-icon" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteTestGroupItem;
