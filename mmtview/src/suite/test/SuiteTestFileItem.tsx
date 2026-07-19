import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import TestStepReportPanel, { StepReportItem } from '../../shared/TestStepReportPanel';
import { openRelativeFile } from '../../vsAPI';
import ContextMenuHost, { runInCoreMenuItem } from '../../components/ContextMenuHost';

export type SuiteTestFileItemData = { type: 'test'; path: string; id: string }

interface SuiteTestFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
    status: StepStatus;

    reportsById: Record<string, StepReportItem[]>;
    runStateById: Record<string, StepStatus>;

    onRun?: () => void;
    onRunInCore?: () => void;
    runButtonTitle?: string;
    runDisabled?: boolean;

    displayPath?: string;
}

const SuiteTestFileItem: React.FC<SuiteTestFileItemProps> = ({
    item,
    context,
    arrow,
    children,
    missingFiles,
    statusIconFor,
    status,
    reportsById,
    runStateById,
    onRun,
    onRunInCore,
    runButtonTitle = 'Run',
    runDisabled = false,
    displayPath,
}) => {
    const data = item.data as SuiteTestFileItemData;
    const isMissing = missingFiles.has(data.path);
    const statusIcon = isMissing
        ? {
            icon: 'codicon-warning',
            color: 'var(--vscode-editorWarning-foreground, #f8b449)',
            title: 'File not found',
        }
        : statusIconFor(status);

    const id = data.id;
    const runState = id ? (runStateById[id] || 'default') : 'default';
    const stepReports = id ? (reportsById[id] || []) : [];

    const labelPath = (displayPath && displayPath.trim()) ? displayPath : data.path;

    // Show reports when the node is expanded or when the test is actively running.
    // This lets users collapse the report after a run completes.
    const shouldShowReports = context?.isExpanded;

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div
                className="tree-view-box tree-view-box-row"
                {...context.itemContainerWithoutChildrenProps}
            >
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
                        <span className="codicon codicon-beaker" aria-hidden title="Test" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
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
            {shouldShowReports && (
                <div style={{ paddingBottom: 8 }}>
                    <TestStepReportPanel
                        isExpanded={true}
                        stepReports={stepReports}
                        runState={runState === 'running' ? 'running' : runState === 'passed' ? 'passed' : 'failed'}
                        showHeader={false}
                    />
                </div>
            )}
        </div>
    );
};

export default SuiteTestFileItem;
