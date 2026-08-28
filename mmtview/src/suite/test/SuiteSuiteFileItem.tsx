import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import { openRelativeFile } from '../../vsAPI';
import TreeRunButton from '../../components/TreeRunButton';
import {
    handleSuiteFileLabelActivate,
    isOpenFileModifier,
    suiteFileLabelTitle,
} from './suiteTreeLabelClick';
import { areSuiteTreeRowPropsEqual } from './suiteTreeRowMemo';

export type SuiteSuiteFileItemData = { type: 'suite'; path: string; id: string };

interface SuiteSuiteFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
    status: StepStatus;

    onRun?: () => void;
    onRunInCore?: () => void;
    runButtonTitle?: string;
    runDisabled?: boolean;

    displayPath?: string;
}

const SuiteSuiteFileItem: React.FC<SuiteSuiteFileItemProps> = ({
    item,
    context,
    arrow,
    children,
    missingFiles,
    statusIconFor,
    status,
    onRun,
    onRunInCore,
    runButtonTitle = 'Run',
    runDisabled = false,
    displayPath,
}) => {
    const data = item.data as SuiteSuiteFileItemData;
    const isMissing = missingFiles.has(data.path);

    const statusIcon = isMissing
        ? {
            icon: 'codicon-warning',
            color: 'var(--vscode-editorWarning-foreground, #f8b449)',
            title: 'File not found',
        }
        : status === 'cancelled'
            ? {
                icon: 'codicon-stop-circle',
                color: ' #f88349',
                title: 'Cancelled',
            }
            : status === 'default'
                ? {
                    icon: 'codicon-circle-large',
                    color: 'var(--vscode-editor-foreground, #c5c5c5)',
                    title: 'Suite',
                }
                : statusIconFor(status as any);

    const labelPath = (displayPath && displayPath.trim()) ? displayPath : data.path;

    const activateLabel = (event: React.MouseEvent | React.KeyboardEvent, openFile: boolean) => {
        handleSuiteFileLabelActivate({
            event,
            isMissing,
            path: data.path,
            openFile,
            toggleExpanded: context?.toggleExpandedState,
            openRelativeFile,
        });
    };

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div className="tree-view-box tree-view-box-row" {...context.itemContainerWithoutChildrenProps}>
                <div className="tree-view-box-row-arrow">{arrow}</div>
                <div className="tree-view-box-row-main">
                    <div
                        className={`tree-view-box-row-label${isMissing ? '' : ' tree-view-box-row-label-link'}`}
                        title={isMissing ? data.path : suiteFileLabelTitle(data.path)}
                        role={isMissing ? undefined : 'button'}
                        tabIndex={isMissing ? undefined : 0}
                        onMouseEnter={(e) => {
                            if (isMissing) {
                                return;
                            }
                            (e.currentTarget as any).style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                            if (isMissing) {
                                return;
                            }
                            (e.currentTarget as any).style.opacity = '1';
                        }}
                        onClick={(e) => activateLabel(e, isOpenFileModifier(e))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                activateLabel(e, isOpenFileModifier(e));
                            }
                        }}
                    >
                        <span
                            className={`codicon ${statusIcon.icon}`}
                            aria-hidden
                            title={statusIcon.title}
                            style={{ color: statusIcon.color }}
                        />
                        <span className="codicon codicon-package" aria-hidden title="Suite" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
                        {labelPath}
                    </div>
                    {onRun && !isMissing && (
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

export default React.memo(SuiteSuiteFileItem, areSuiteTreeRowPropsEqual);
