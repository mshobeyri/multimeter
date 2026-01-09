import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItem } from 'react-complex-tree';
import SuiteTestGroupItem from './SuiteTestGroupItem';
import SuiteTestFileItem from './SuiteTestFileItem';
import { StepStatus, SuiteGroup } from '../types';
import { SuiteImportTreeNode } from './suiteImportTree';
import { useSuiteImportTree } from './useSuiteImportTree';

export type SuiteTestTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string }
  | { type: 'file'; path: string }
  | { type: 'import-suite-info'; label: string }
  | { type: 'import-group'; label: string }
  | { type: 'import-file'; path: string; docType?: string; cycle?: boolean; error?: string };

interface SuiteTestTreeProps {
  groups: SuiteGroup[];
  missingFiles: Set<string>;
  stepStatuses: Record<string, StepStatus | 'running'>;
  lastRunIdByEntryId: Record<string, string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };
}

const buildBaseTestTree = (groups: SuiteGroup[]) => {
  const items: Record<string, TreeItem<SuiteTestTreeItemData>> = {};
  const allPaths: string[] = [];
  const groupIds: string[] = [];

  let localSuffix = 0;
  const ensureEntryId = (path: string) => `suite-entry-test-${localSuffix++}:${path}`;

  groups.forEach((group, idx) => {
    const groupId = `group-${idx + 1}`;
    const childIds: string[] = [];
    group.entries.forEach((entry) => {
      const id = entry.id || ensureEntryId(entry.path);
      childIds.push(id);
      allPaths.push(entry.path);
      items[id] = {
        index: id,
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

  return { items, allPaths, groupIds };
};

const SuiteTestTree: React.FC<SuiteTestTreeProps> = ({
  groups,
  missingFiles,
  stepStatuses,
  lastRunIdByEntryId,
  statusIconFor,
}) => {
  const base = useMemo(() => buildBaseTestTree(groups), [groups]);
  const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);

  const importTree = useSuiteImportTree(base.allPaths, true);

  // Expand base group nodes by default — one-time on mount.
  useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      base.groupIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, [base.groupIds]);

  const buildImportItems = useCallback(
    (parentId: string, node: SuiteImportTreeNode, itemsAcc: Record<string, TreeItem<SuiteTestTreeItemData>>): string => {
      const nodeId = `import:${parentId}:${node.id}`;
      const isSuiteInfo = node.kind === 'suite-info' || node.id.startsWith('suite-import-node:suite-info:');
      const isGroup = node.kind === 'group' || node.id.startsWith('suite-import-node:group:');

      const childIds: string[] = [];
      if (node.children && node.children.length) {
        for (const child of node.children) {
          childIds.push(buildImportItems(nodeId, child, itemsAcc));
        }
      }

      if (isSuiteInfo) {
        itemsAcc[nodeId] = {
          index: nodeId,
          isFolder: childIds.length > 0,
          children: childIds,
          data: { type: 'import-suite-info', label: node.path },
        };
        return nodeId;
      }

      if (isGroup) {
        itemsAcc[nodeId] = {
          index: nodeId,
          isFolder: true,
          children: childIds,
          data: { type: 'import-group', label: node.path },
        };
        return nodeId;
      }

      itemsAcc[nodeId] = {
        index: nodeId,
        isFolder: true,
        children: childIds,
        data: { type: 'import-file', path: node.path, docType: node.docType, cycle: node.cycle, error: node.error },
      };
      return nodeId;
    },
    []
  );

  const treeData = useMemo(() => {
    const items: Record<string, TreeItem<SuiteTestTreeItemData>> = { ...base.items };

    const importedRootsByPath = new Map(importTree.rootNodes.map((n) => [n.path, n]));

    groups.forEach((group) => {
      group.entries.forEach((entry) => {
        const item = items[entry.id];
        if (!item) {
          return;
        }
        const root = importedRootsByPath.get(entry.path);
        if (!root) {
          return;
        }

        if (root.docType === 'suite' && !root.cycle) {
          items[entry.id] = { ...item, isFolder: true };
        }

        const isExpanded = expandedItems.includes(entry.id);
        if (!isExpanded) {
          return;
        }

        const childIds: string[] = [];
        const suiteInfoNode = root.children?.find((c) => c.kind === 'suite-info' || c.id.startsWith('suite-import-node:suite-info:'));
        const groupNodes = root.children?.filter((c) => c.kind === 'group' || c.id.startsWith('suite-import-node:group:')) || [];
        if (suiteInfoNode) {
          // Instead of inserting a separate "Suite info" box, attach group nodes
          // directly under the file entry so users see groups immediately.
          for (const groupNode of groupNodes) {
            childIds.push(buildImportItems(entry.id, groupNode, items));
          }
        } else if (root.children && root.children.length) {
          for (const child of root.children) {
            childIds.push(buildImportItems(entry.id, child, items));
          }
        }

        items[entry.id] = { ...items[entry.id], children: childIds };
      });
    });

    return { items };
  }, [base.items, buildImportItems, expandedItems, groups, importTree.rootNodes]);

  const handleExpand = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      setExpandedItems((prev) => (prev.includes(String(item.index)) ? prev : [...prev, String(item.index)]));
      if (item.data?.type === 'file') {
        const path = (item.data as any).path as string;
        const root = importTree.rootNodes.find((n) => n.path === path);
        if (root) {
          importTree.expandNode(root);
        }
      }
    },
    [importTree]
  );

  const handleCollapse = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      setExpandedItems((prev) => prev.filter((id) => id !== String(item.index)));
      if (item.data?.type === 'file') {
        const path = (item.data as any).path as string;
        const root = importTree.rootNodes.find((n) => n.path === path);
        if (root) {
          importTree.collapseNode(root);
        }
      }
    },
    [importTree]
  );

  const getGroupStatus = useCallback((): StepStatus => 'default', []);

  const renderItem = ({ item, context, arrow, children }: any) => {
    const data = item.data as SuiteTestTreeItemData;

    if (data.type === 'group' || data.type === 'root' || data.type === 'import-group') {
      return (
        <SuiteTestGroupItem
          item={item}
          context={context}
          arrow={arrow}
          children={children}
          getGroupStatus={getGroupStatus}
          statusIconFor={statusIconFor}
          canShowStatusIcon={data.type === 'group' || data.type === 'root'}
        />
      );
    }

    if (data.type === 'import-suite-info') {
      return (
        <div {...context.itemContainerWithChildrenProps}>
          <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{ paddingTop: 10, display: 'flex' }}>
            {arrow}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, opacity: 0.9 }}>
              <span className="codicon codicon-info" aria-hidden style={{ opacity: 0.75 }} />
              <div
                style={{
                  fontFamily: 'var(--vscode-editor-font-family)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
                title={data.label}
              >
                {data.label}
              </div>
            </div>
          </div>
          {children}
        </div>
      );
    }

    return (
      <SuiteTestFileItem
        item={item as any}
        context={context}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        status={(() => {
          const entryId = String(item.index);
          const runId = lastRunIdByEntryId[entryId];
          if (runId && stepStatuses[runId]) {
            return stepStatuses[runId] as StepStatus;
          }
          return (stepStatuses[entryId] ?? 'default') as StepStatus;
        })()}
      />
    );
  };

  return (
    <ControlledTreeEnvironment
      items={treeData.items}
      getItemTitle={(item) => {
        const data = item.data as SuiteTestTreeItemData;
        if (data?.type === 'file') {
          return data.path;
        }
        if (data?.type === 'import-file') {
          return data.path;
        }
        if (data?.type === 'root' || data?.type === 'group' || data?.type === 'import-group' || data?.type === 'import-suite-info') {
          return (data as any).label;
        }
        return '';
      }}
      canDragAndDrop={false}
      canDropOnFolder={false}
      canReorderItems={false}
      canSearch={false}
      canSearchByStartingTyping={false}
      viewState={{ 'suite-test-tree': { expandedItems } }}
      onExpandItem={handleExpand}
      onCollapseItem={handleCollapse}
      onDrop={undefined}
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
      <Tree treeId="suite-test-tree" rootItem="suite-root" treeLabel="Suite structure" />
    </ControlledTreeEnvironment>
  );
};

export default SuiteTestTree;
