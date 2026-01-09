import React, { useCallback, useMemo } from 'react';
import { ControlledTreeEnvironment, DraggingPosition, DraggingPositionBetweenItems, DraggingPositionItem, Tree, TreeItem } from 'react-complex-tree';
import { SuiteEntry, SuiteGroup, StepStatus } from './types';
import { SuiteFileItem } from './SuiteFileItem';
import { SuiteGroupItem } from './SuiteGroupItem';

export type SuiteEditTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string }
  | { type: 'file'; path: string };

interface SuiteEditTreeProps {
  groups: SuiteGroup[];
  expandedItems: string[];
  setExpandedItems: (next: string[]) => void;
  missingFiles: Set<string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
  groupsModel: SuiteGroup[];
  persistGroups: (groups: SuiteGroup[]) => void;
  canEdit: boolean;
  handleDrop?: (draggedItems: any[], target: DraggingPosition) => void;
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
  expandedItems,
  setExpandedItems,
  missingFiles,
  statusIconFor,
  groupsModel,
  persistGroups,
  canEdit,
  handleDrop,
}) => {
  const { items, groupIds } = useMemo(() => buildSuiteEditTree(groups), [groups]);

  const getGroupStatus = useCallback(
    (itemId: string): StepStatus => {
      const childIds = items[itemId]?.children || [];
      if (!childIds.length) {
        return 'default';
      }
      const statuses = childIds.map((childId) => {
        const child = items[childId];
        if (child?.data?.type === 'file') {
          if (missingFiles.has((child.data as any).path)) {
            return 'failed';
          }
          return 'default';
        }
        return 'default';
      });
      if (statuses.includes('failed')) {
        return 'failed';
      }
      return 'default';
    },
    [items, missingFiles]
  );

  const onExpandItem = useCallback(
    (item: TreeItem<SuiteEditTreeItemData>) => {
      setExpandedItems(expandedItems.includes(String(item.index)) ? expandedItems : [...expandedItems, String(item.index)]);
    },
    [expandedItems, setExpandedItems]
  );

  const onCollapseItem = useCallback(
    (item: TreeItem<SuiteEditTreeItemData>) => {
      setExpandedItems(expandedItems.filter((id) => id !== String(item.index)));
    },
    [expandedItems, setExpandedItems]
  );

  // Expand all group nodes by default.
  React.useEffect(() => {
    const next = new Set(expandedItems);
    groupIds.forEach((id) => next.add(id));
    if (next.size !== expandedItems.length) {
      setExpandedItems(Array.from(next));
    }
  }, [expandedItems, groupIds, setExpandedItems]);

  const renderItem = ({ item, context, arrow, children }: any) => {
    const data = item.data as SuiteEditTreeItemData;
    if (data.type === 'group' || data.type === 'root') {
      return (
        <SuiteGroupItem
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
      <SuiteFileItem
        item={item as any}
        context={context}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        groups={groupsModel}
        persistGroups={persistGroups}
        status={'default'}
        canEdit={canEdit}
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
      onSelectItems={() => {}}
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
