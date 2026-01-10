import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../types';

export type SuiteSuiteFileItemData = { type: 'suite'; path: string };

interface SuiteSuiteFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;

    statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
    status: StepStatus | 'running' | 'cancelled';
    leafId: string;
    leafRunStateByLeafId: Record<string, 'idle' | 'running' | 'passed' | 'failed' | 'cancelled'>;
}

const SuiteSuiteFileItem: React.FC<SuiteSuiteFileItemProps> = ({
    item,
    context,
    arrow,
    children,
    missingFiles,
    statusIconFor,
    status,
    leafId,
    leafRunStateByLeafId,
}) => {
    const data = item.data as SuiteSuiteFileItemData;
    const isMissing = missingFiles.has(data.path);

    const leafRunState = leafId ? (leafRunStateByLeafId[leafId] || 'idle') : 'idle';
    const effectiveStatus: StepStatus | 'running' | 'cancelled' = (() => {
        if (leafRunState === 'running') {
            return 'running';
        }
        if (leafRunState === 'cancelled') {
            return 'cancelled';
        }
        if (leafRunState === 'passed' || leafRunState === 'failed') {
            return leafRunState;
        }
        return status;
    })();

    const statusIcon = isMissing
        ? {
            icon: 'codicon-warning',
            color: 'var(--vscode-editorWarning-foreground, #f8b449)',
            title: 'File not found',
        }
        : effectiveStatus === 'cancelled'
        ? {
            icon: 'codicon-stop-circle',
            color: ' #f88349',
            title: 'Cancelled',
        }
        : effectiveStatus === 'default'
        ? {
            icon: 'codicon-circle-large',
            color: 'var(--vscode-editor-foreground, #c5c5c5)',
            title: 'Suite',
        }
        : statusIconFor(effectiveStatus as any);

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{ paddingTop: 10, display: 'flex' }}>
                <div style={{ width: 24, minWidth: 24, display: 'inline-flex', alignItems: 'flex-start' }}>{arrow}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                        className={`codicon ${statusIcon.icon}`}
                        aria-hidden
                        title={statusIcon.title}
                        style={{ color: statusIcon.color }}
                    />
                    <div
                        style={{
                            fontFamily: 'var(--vscode-editor-font-family)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                        }}
                        title={data.path}
                    >
                        {data.path} - {data.type}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );
};

export default SuiteSuiteFileItem;
