import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import { openRelativeFile } from '../../vsAPI';
import ContextMenuHost, { runInCoreMenuItem } from '../../components/ContextMenuHost';

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

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div className="tree-view-box tree-view-box-row" {...context.itemContainerWithoutChildrenProps}>
                <div className="tree-view-box-row-arrow">{arrow}</div>
                <div className="tree-view-box-row-main">
                    <div
                        className={`tree-view-box-row-label${isMissing ? '' : ' tree-view-box-row-label-link'}`}
                        title={data.path}
                        role={isMissing ? undefined : 'link'}
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
                        onClick={(e) => {
                            if (isMissing) {
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            openRelativeFile(data.path);
                        }}
                        onKeyDown={(e) => {
                            if (isMissing) {
                                return;
                            }
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                openRelativeFile(data.path);
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
                        <ContextMenuHost
                            items={
                              runDisabled
                                ? undefined
                                : [runInCoreMenuItem(onRunInCore || onRun)]
                            }
                        >
                            <button
                                className="tab-button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRun();
                                }}
                                title={runButtonTitle}
                                disabled={runDisabled}
                                style={{ padding: 6 }}
                            >
                                <span className="codicon codicon-run tab-button-icon" aria-hidden />
                            </button>
                        </ContextMenuHost>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};

export default SuiteSuiteFileItem;
