import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../types';
import TestStepReportPanel, { StepReportItem } from '../../shared/TestStepReportPanel';

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
                        }}
                        title={data.path}
                    >
                        {data.path} - {data.type}
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
            {context?.isExpanded && (
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
