import React, { useContext } from 'react';
import { TreeItem } from 'react-complex-tree';
import FilePickerInput from '../../components/FilePickerInput';
import { FileContext } from '../../fileContext';
import { SuiteGroup } from '../types';
import { StepStatus } from '../../shared/types';
import { isDuplicateSuiteServerPath } from '../../text/validator';

export type SuiteEditFileItemData = { type: 'file'; path: string };

interface SuiteEditFileItemProps {
    item: TreeItem<any>;
    context: any;
    arrow: React.ReactNode;
    children: React.ReactNode;
    missingFiles: Set<string>;
    duplicateServerKeys?: Set<string>;
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
    duplicateServerKeys,
    groups,
    persistGroups,
    status,
}) => {
    const data = item.data as SuiteEditFileItemData;
    const fileContext = useContext(FileContext);
    const isMissing = missingFiles.has(data.path);
    const isDuplicateServer = Boolean(
      duplicateServerKeys && isDuplicateSuiteServerPath(data.path, duplicateServerKeys),
    );
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
            className="field-grow"
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
                className="tree-view-box is-row"
                {...context.itemContainerWithoutChildrenProps}
            >
                <div className="tree-arrow-slot">{arrow}</div>
                <div className="tree-row-grow">
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
                            showFilePicker
                            removable
                            invalid={isDuplicateServer}
                        />
                    </NoTreeInterference>
                </div>

                <span
                    {...context.interactiveElementProps}
                    title="Drag to reorder"
                    onMouseDownCapture={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    className={['tree-grip', context.interactiveElementProps?.className].filter(Boolean).join(' ')}
                >
                    <span className="codicon codicon-gripper" aria-hidden />
                </span>

            </div>
            {children}
        </div>
    );
};

export default SuiteEditFileItem;
