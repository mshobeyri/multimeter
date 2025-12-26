import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { SuiteTreeItemData, StepStatus } from './types';

interface SuiteGroupItemProps {
    item: TreeItem<SuiteTreeItemData>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    getGroupStatus: (itemId: string) => StepStatus;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
}

export const SuiteGroupItem: React.FC<SuiteGroupItemProps> = ({ item, context, arrow, children, getGroupStatus, statusIconFor }) => {
    const data = item.data as SuiteTreeItemData;
    if (data.type !== 'group' && data.type !== 'root') return null;

    const isRoot = data.type === 'root';
    const statusIcon = isRoot
        ? { icon: 'codicon-files', color: 'var(--vscode-editor-foreground, #c5c5c5)', title: 'Suite' }
        : statusIconFor(getGroupStatus(item.index as string));

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{ alignItems: 'flex-start' }}>
                {arrow}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                    <span
                        className={`codicon ${statusIcon.icon}`}
                        aria-hidden
                        style={{ color: statusIcon.color }}
                    />
                    <span style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>{data.label}</span>
                </div>
            </div>
            {children}
        </div>
    );
};
