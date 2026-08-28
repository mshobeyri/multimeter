import React from 'react';
import { TreeItem } from 'react-complex-tree';
import { StepStatus } from '../../shared/types';
import TestStepReportPanel, { StepReportItem } from '../../shared/TestStepReportPanel';
import { openRelativeFile } from '../../vsAPI';
import TreeRunButton from '../../components/TreeRunButton';
import {
    handleSuiteFileLabelActivate,
    isOpenFileModifier,
    suiteFileLabelTitle,
} from './suiteTreeLabelClick';
import { areSuiteTreeRowPropsEqual } from './suiteTreeRowMemo';

export type SuiteTestFileItemData = { type: 'test'; path: string; id: string }

interface SuiteTestFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
    status: StepStatus;
    stepReports: StepReportItem[];

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
    stepReports,
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

    const runState = status;

    const labelPath = (displayPath && displayPath.trim()) ? displayPath : data.path;

    // Show reports when the node is expanded (chevron or label click).
    const shouldShowReports = context?.isExpanded;

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
            <div
                className="tree-view-box tree-view-box-row"
                {...context.itemContainerWithoutChildrenProps}
            >
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
                        <span className="codicon codicon-beaker" aria-hidden title="Test" style={{ color: 'var(--vscode-editor-foreground, #c5c5c5)' }} />
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
            {shouldShowReports && (
                <div
                    className="report-selectable"
                    style={{ paddingBottom: 8 }}
                    // Capture mousedown/pointer so the suite tree does not steal focus/selection,
                    // but do NOT stop click in capture — that blocks the details circle button
                    // (same pitfall as TestFlow's NoTreeInterference).
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                >
                    <TestStepReportPanel
                        isExpanded={true}
                        stepReports={stepReports}
                        runState={
                            runState === 'running' || runState === 'passed' || runState === 'failed' ||
                            runState === 'invalid'
                                ? runState
                                : 'failed'
                        }
                        showHeader={false}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(SuiteTestFileItem, areSuiteTreeRowPropsEqual);
