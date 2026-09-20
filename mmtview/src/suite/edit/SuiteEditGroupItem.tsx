import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';

export type SuiteEditGroupItemData = { type: 'group' | 'root'; label: string };

interface SuiteEditGroupItemProps {
  item: TreeItem<any>;
  context: any;
  arrow: React.ReactNode;
  children: React.ReactNode;
  getGroupStatus: (itemId: string) => StepStatus;
  statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
  canShowStatusIcon?: boolean;
}

const SuiteEditGroupItem: React.FC<SuiteEditGroupItemProps> = ({
  item,
  context,
  arrow,
  children,
  getGroupStatus,
  statusIconFor,
  canShowStatusIcon = true,
}) => {
  const data = item.data as SuiteEditGroupItemData;
  if (data.type !== 'group' && data.type !== 'root') {
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
      <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps}>
        {arrow}
        <div className="tree-row">
          {statusIcon && (
            <span className={`codicon ${statusIcon.icon}`} aria-hidden style={{ color: statusIcon.color }} />
          )}
          {isRoot ? (
            <span className="codicon codicon-layers icon-fg" aria-hidden title="Suite" />
          ) : (
            <span className="codicon codicon-collection icon-fg" aria-hidden title="Group" />
          )}
          <span className="tree-label">{data.label}</span>
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteEditGroupItem;
