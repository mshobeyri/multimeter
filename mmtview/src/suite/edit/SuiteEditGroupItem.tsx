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
      <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{ alignItems: 'flex-start' }}>
        {arrow}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
          {statusIcon && (
            <span className={`codicon ${statusIcon.icon}`} aria-hidden style={{ color: statusIcon.color }} />
          )}
          <span style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{data.label}</span>
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteEditGroupItem;
