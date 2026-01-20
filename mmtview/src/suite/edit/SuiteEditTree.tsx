import React, { useCallback, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, DraggingPosition, DraggingPositionBetweenItems, DraggingPositionItem, Tree, TreeItem } from 'react-complex-tree';
import { SuiteEntry } from '../types';
import { SuiteGroup } from '../types';
import { StepStatus } from '../../shared/types';
import SuiteEditFileItem from './SuiteEditFileItem';
import SuiteEditGroupItem from './SuiteEditGroupItem';
import { aggregateStatuses } from '../../shared/Common';

export type SuiteEditTreeItemData =
    | { type: 'root'; label: string }
    | { type: 'group'; label: string }
    | { type: 'file'; path: string };

interface SuiteEditTreeProps {
    groups: SuiteGroup[];
    missingFiles: Set<string>;
    statusIconFor: (status: StepStatus) => { icon: string; color: string; title: string };
    groupsModel: SuiteGroup[];
    persistGroups: (groups: SuiteGroup[]) => void;
    canEdit: boolean;
}

const buildSuiteEditTree = (groups: SuiteGroup[]) => {
    const items: Record<string, TreeItem<SuiteEditTreeItemData>> = {};
    const groupIds: string[] = [];

    groups.forEach((group, idx) => {
        const groupId = `group-${idx + 1}`;
        const childIds: string[] = [];
        group.entries.forEach((entry) => {
            childIds.push(entry.id);
            items[entry.id] = {
                index: entry.id,
                isFolder: false,
                children: [],
                data: { type: 'file', path: entry.path },
            };
        });
        items[groupId] = {
            index: groupId,
            isFolder: true,
            children: childIds,
            data: { type: 'group', label: group.label },
        };
        groupIds.push(groupId);
    });

    items['suite-root'] = {
        index: 'suite-root',
        isFolder: true,
        children: groupIds,
        data: { type: 'root', label: 'Suite' },
    };

    return { items, groupIds };
};

const SuiteEditTree: React.FC<SuiteEditTreeProps> = ({
    groups,
    missingFiles,
    statusIconFor,
    groupsModel,
    persistGroups,
    canEdit,
}) => {
    const { items, groupIds } = useMemo(() => buildSuiteEditTree(groups), [groups]);
    const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);

    const getGroupStatus = useCallback(
        (itemId: string): StepStatus => {
            const childIds = items[itemId]?.children || [];
            if (!childIds.length) {
                return 'default';
            }
            const statuses: Array<StepStatus | undefined> = childIds.map((childId) => {
                const child = items[childId];
                if (child?.data?.type === 'file') {
                    if (missingFiles.has((child.data as any).path)) {
                        return 'failed';
                    }
                    return 'default';
                }
                return 'default';
            });
            return aggregateStatuses(statuses);
        },
        [items, missingFiles]
    );

    const onExpandItem = useCallback(
        (item: TreeItem<SuiteEditTreeItemData>) => {
            setExpandedItems(prev => (prev.includes(String(item.index)) ? prev : [...prev, String(item.index)]));
        },
        []
    );

    const onCollapseItem = useCallback(
        (item: TreeItem<SuiteEditTreeItemData>) => {
            setExpandedItems(prev => prev.filter((id) => id !== String(item.index)));
        },
        []
    );

    // Expand all group nodes by default when the group list changes.
    React.useEffect(() => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            next.add('suite-root');
            groupIds.forEach((id) => next.add(id));
            return Array.from(next);
        });
    }, [groupIds]);

    // Local maps used for drag/drop calculations.
    const groupIdToIndex = useMemo(() => {
        const map = new Map<string, number>();
        groupIds.forEach((gid, idx) => map.set(gid, idx));
        return map;
    }, [groupIds]);
    const entryById = useMemo(() => {
        const map = new Map<string, SuiteEntry>();
        groups.forEach(group => group.entries.forEach(entry => map.set(entry.id, entry)));
        return map;
    }, [groups]);
    const entryPositions = useMemo(() => {
        const map = new Map<string, { group: number; idx: number }>();
        groups.forEach((group, groupIdx) => {
            group.entries.forEach((entry, idx) => map.set(entry.id, { group: groupIdx, idx }));
        });
        return map;
    }, [groups]);

    const handleDrop = useCallback((draggedItems: any[], target: DraggingPosition) => {
        if (!draggedItems?.length) {
            return;
        }
        const entriesToMove = draggedItems
            .map(di => entryById.get(di.index))
            .filter((entry): entry is SuiteEntry => Boolean(entry));
        if (!entriesToMove.length) {
            return;
        }

        const nextGroups = groups.map(group => ({
            ...group,
            entries: group.entries.filter(entry => !entriesToMove.some(moved => moved.id === entry.id)),
        }));

        const parentItemId = 'parentItem' in target && typeof target.parentItem === 'string' ? target.parentItem : undefined;
        let targetGroupIdx = parentItemId ? groupIdToIndex.get(parentItemId) ?? -1 : -1;
        let insertBase = 0;

        if (target.targetType === 'between-items') {
            insertBase = (target as DraggingPositionBetweenItems).childIndex ?? 0;
        } else if (target.targetType === 'item') {
            const targetItem = (target as DraggingPositionItem).targetItem;
            const position = entryPositions.get(String(targetItem));
            targetGroupIdx = position?.group ?? targetGroupIdx;
            insertBase = (position?.idx ?? nextGroups[targetGroupIdx]?.entries.length ?? 0) + 1;
        } else {
            targetGroupIdx = nextGroups.length - 1;
            insertBase = nextGroups[targetGroupIdx]?.entries.length ?? 0;
        }

        if (targetGroupIdx < 0) {
            targetGroupIdx = nextGroups.length ? nextGroups.length - 1 : 0;
        }

        if (!nextGroups[targetGroupIdx]) {
            nextGroups[targetGroupIdx] = { label: `Group ${targetGroupIdx + 1}`, entries: [] };
        }

        const removedBefore = entriesToMove.reduce((count, entry) => {
            const pos = entryPositions.get(entry.id);
            if (pos?.group === targetGroupIdx && typeof pos.idx === 'number' && pos.idx < insertBase) {
                return count + 1;
            }
            return count;
        }, 0);

        const insertIdx = Math.max(0, Math.min(insertBase - removedBefore, nextGroups[targetGroupIdx].entries.length));

        nextGroups[targetGroupIdx].entries.splice(insertIdx, 0, ...entriesToMove);
        persistGroups(nextGroups);
    }, [groups, entryById, entryPositions, groupIdToIndex, persistGroups]);

    const renderItem = ({ item, context, arrow, children }: any) => {
        const data = item.data as SuiteEditTreeItemData;
        if (data.type === 'group' || data.type === 'root') {
            return (
                <SuiteEditGroupItem
                    item={item}
                    context={context}
                    arrow={arrow}
                    children={children}
                    getGroupStatus={getGroupStatus}
                    statusIconFor={statusIconFor}
                    canShowStatusIcon={false}
                />
            );
        }

        return (
            <SuiteEditFileItem
                item={item as any}
                context={context}
                arrow={arrow}
                children={children}
                missingFiles={missingFiles}
                groups={groupsModel}
                persistGroups={persistGroups}
                status={'default'}
            />
        );
    };

    return (
        <ControlledTreeEnvironment
            items={items}
            getItemTitle={(item) => {
                const data = item.data as SuiteEditTreeItemData;
                if (data?.type === 'file') {
                    return data.path;
                }
                if (data?.type === 'group' || data?.type === 'root') {
                    return data.label;
                }
                return '';
            }}
            canDragAndDrop={canEdit}
            canDropOnFolder={canEdit}
            canReorderItems={canEdit}
            canSearch={false}
            canSearchByStartingTyping={false}
            viewState={{ 'suite-edit-tree': { expandedItems } }}
            onExpandItem={onExpandItem}
            onCollapseItem={onCollapseItem}
            onDrop={canEdit ? handleDrop : undefined}
            onSelectItems={() => { }}
            renderItemArrow={({ item, context }) =>
                item.isFolder ? (
                    <span {...context.arrowProps} style={{ display: 'inline-flex', paddingTop: 8, lineHeight: 0, alignSelf: 'flex-start' }}>
                        {context.isExpanded ? (
                            <span className="codicon codicon-chevron-down" style={{ fontSize: 16 }} />
                        ) : (
                            <span className="codicon codicon-chevron-right" style={{ fontSize: 16 }} />
                        )}
                    </span>
                ) : (
                    <span style={{ display: 'inline-block', width: 24, height: 24 }} />
                )
            }
            renderItem={renderItem}
            renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
            renderItemsContainer={({ children, containerProps }) => (
                <ul {...containerProps} style={{ ...(containerProps.style || {}), margin: 0, listStyle: 'none' }}>
                    {children}
                </ul>
            )}
            renderDragBetweenLine={({ lineProps }) => (
                <div {...lineProps} style={{ background: 'var(--vscode-focusBorder, #264f78)', height: '1px' }} />
            )}
        >
            <Tree treeId="suite-edit-tree" rootItem="suite-root" treeLabel="Suite structure" />
        </ControlledTreeEnvironment>
    );
};

export default SuiteEditTree;
