import React, { useContext } from 'react';
import { TreeItem } from 'react-complex-tree';
import { SuiteTreeItemData, StepStatus, SuiteGroup } from './types';
import FilePickerInput from '../components/FilePickerInput';
import { FileContext } from '../fileContext';

interface SuiteFileItemProps {
    item: TreeItem<SuiteTreeItemData>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
    groups: SuiteGroup[];
    persistGroups: (groups: SuiteGroup[]) => void;
    status: StepStatus;
}

export const SuiteFileItem: React.FC<SuiteFileItemProps> = ({
    item, context, arrow, children, missingFiles, statusIconFor, groups, persistGroups, status
}) => {
    const data = item.data as { type: 'file', path: string };
    const isMissing = missingFiles.has(data.path);
    const statusIcon = isMissing
        ? {
            icon: 'codicon-warning',
            color: 'var(--vscode-editorWarning-foreground, #f8b449)',
            title: 'File not found',
        }
        : statusIconFor(status);

    const stopTreeEvent = (event: React.SyntheticEvent) => event.stopPropagation();
    const NoTreeInterference: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div
            onMouseDownCapture={stopTreeEvent}
            onFocusCapture={stopTreeEvent}
            onKeyDown={stopTreeEvent}
            onKeyUp={stopTreeEvent}
            onInputCapture={stopTreeEvent}
            style={{ flex: 1, minWidth: 0 }}
        >
            {children}
        </div>
    );

    const onChange = (value: string) => {
        const nextGroups = groups.map(group => ({
            ...group,
            entries: group.entries.map(entry =>
                entry.id === item.index ? { ...entry, path: value } : entry
            ),
        }));
        persistGroups(nextGroups);
    };

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{ paddingTop: 10, display: 'flex' }}>
                {arrow}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                        className={`codicon ${statusIcon.icon}`}
                        aria-hidden
                        title={statusIcon.title}
                        style={{ color: statusIcon.color }}
                    />
                    <NoTreeInterference>
                        <FilePickerInput
                            value={data.path}
                            onChange={(rel) => onChange(rel)}
                            basePath={useContext(FileContext).mmtFilePath}
                            filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
                        />
                    </NoTreeInterference>
                </div>
                <span
                    {...context.interactiveElementProps}
                    title="Drag to reorder"
                    onMouseDownCapture={e => e.stopPropagation()}
                    onPointerDownCapture={e => e.stopPropagation()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        minWidth: 24,
                        height: 24,
                        opacity: 0.7,
                        cursor: 'grab',
                        userSelect: 'none',
                    }}
                >
                    <span className="codicon codicon-gripper" aria-hidden />
                </span>
            </div>
            {children}
        </div>
    );
};
