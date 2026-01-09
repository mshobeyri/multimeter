import React, { useContext } from 'react';
import { TreeItem } from 'react-complex-tree';
import FilePickerInput from '../../components/FilePickerInput';
import { FileContext } from '../../fileContext';
import { StepStatus, SuiteGroup } from '../types';

export type SuiteEditFileItemData = { type: 'file'; path: string };

interface SuiteEditFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    groups: SuiteGroup[];
    persistGroups: (groups: SuiteGroup[]) => void;
    status: StepStatus;
}

const SuiteEditFileItem: React.FC<SuiteEditFileItemProps> = ({
    item,
    context,
    arrow,
    children,
    missingFiles,
    groups,
    persistGroups,
    status,
}) => {
    const data = item.data as SuiteEditFileItemData;
    const fileContext = useContext(FileContext);
    const isMissing = missingFiles.has(data.path);
    const statusIcon = isMissing
        ? {
            icon: 'codicon-warning',
            color: 'var(--vscode-editorWarning-foreground, #f8b449)',
            title: 'File not found',
        }
        : {
            icon: 'codicon-beaker',
            color: 'var(--vscode-foreground, #c5c5c5)',
            title: 'Suite/Test',
        }

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
        const nextGroups = groups.map((group) => ({
            ...group,
            entries: group.entries.map((entry) => (entry.id === item.index ? { ...entry, path: value } : entry)),
        }));
        persistGroups(nextGroups);
    };

    return (
        <div {...context.itemContainerWithChildrenProps}>
            <div
                className="tree-view-box"
                {...context.itemContainerWithoutChildrenProps}
                style={{ paddingTop: 10, display: 'flex' }}
            >
                <div style={{ width: 24, minWidth: 24, display: 'inline-flex', alignItems: 'flex-start' }}>{arrow}</div>
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
                            basePath={fileContext.mmtFilePath}
                            filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
                            onRemovePressed={() => onChange('')}
                        />
                    </NoTreeInterference>
                </div>

                <span
                    {...context.interactiveElementProps}
                    title="Drag to reorder"
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
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

export default SuiteEditFileItem;
