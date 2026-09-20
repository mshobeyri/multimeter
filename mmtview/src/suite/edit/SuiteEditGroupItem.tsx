import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import { StatusGlyph, SuiteKindIcon } from '../../components/StatusGlyph';

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
            <StatusGlyph icon={statusIcon.icon} color={statusIcon.color} title={statusIcon.title} />
          )}
          <SuiteKindIcon kind={isRoot ? 'root' : 'group'} />
          <span className="tree-label">{data.label}</span>
        </div>
      </div>
      {children}
    </div>
  );
};

export default SuiteEditGroupItem;
