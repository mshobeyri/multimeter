import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../types';
import TestStepReportPanel, { StepReportItem } from '../../shared/TestStepReportPanel';
import { openRelativeFile } from '../../vsAPI';

export type SuiteTestFileItemData = { type: 'test'; path: string; id: string }

interface SuiteTestFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
    status: StepStatus;

    reportsById: Record<string, StepReportItem[]>;
    runStateById: Record<string, 'idle' | 'running' | 'passed' | 'failed' | 'cancelled'>;

    onRun?: () => void;
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
    const runState = id ? (runStateById[id] || 'idle') : 'idle';
    const stepReports = id ? (reportsById[id] || []) : [];

    const labelPath = (displayPath && displayPath.trim()) ? displayPath : data.path;

    // Show reports when the node is expanded or when the test is actively running.
    // This lets users collapse the report after a run completes.
    const shouldShowReports = context?.isExpanded;

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div
                className="tree-view-box"
                {...context.itemContainerWithoutChildrenProps}
                style={{ paddingTop: 10, display: 'flex' }}
            >
                <div style={{ width: 24, minWidth: 24, display: 'inline-flex', alignItems: 'flex-start' }}>{arrow}</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
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
                                minWidth: 0,
                                cursor: isMissing ? 'default' : 'pointer',
                                opacity: isMissing ? 1 : undefined,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
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
                                // Open on plain click. Prevent propagation so the tree
                                // doesn't also treat the click as selection/expand.
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
                            {/* Type icon for test */}
                            <span className="codicon codicon-beaker" aria-hidden title="Test" style={{ marginRight: 6, color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
                            {labelPath}
                        </div>
                    </div>
                    {onRun && !isMissing && (
                        <button
                            className="tab-button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRun();
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
            {shouldShowReports && (
                <div style={{ paddingBottom: 8 }}>
                    <TestStepReportPanel
                        isExpanded={true}
                        stepReports={stepReports}
                        runState={runState === 'cancelled' ? 'failed' : runState}
                        showHeader={false}
                    />
                </div>
            )}
        </div>
    );
};

export default SuiteTestFileItem;
