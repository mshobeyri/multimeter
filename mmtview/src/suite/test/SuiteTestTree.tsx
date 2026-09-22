import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItem } from 'react-complex-tree';
import { createSuiteNodeId } from 'mmt-core/suiteNodeId';
import SuiteTestGroupItem from './SuiteTestGroupItem';
import SuiteTestFileItem from './SuiteTestFileItem';
import SuiteSuiteFileItem from './SuiteSuiteFileItem';
import { SuiteGroup } from '../types';
import { StepStatus } from '../../shared/types';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { SuiteTreeNode, suiteTreeChildren } from './suiteHierarchy';
import { ownRunStatus } from './suiteRunStatus';
import { ReportStatusFilter, filterTreeItemsByStatus } from '../../shared/reportStatusFilter';
import ReportEmptyFilterPlaceholder from '../../shared/ReportEmptyFilterPlaceholder';
import { TREE_DEPTH_OFFSET, TreeFolderArrow, treeDragBetweenLineStyle } from '../../components/TreeChevron';
import { applyGroupChildrenRangeLabels, suiteTreeItemDisplayName } from './suiteTreeGroupRangeLabel';

const EMPTY_STEP_REPORTS: StepReportItem[] = [];

export type SuiteTestTreeHandle = {
  collapseAll: () => void;
};

/** True when bundleId is the entry itself or a descendant under that entry's id prefix. */
const bundleIdBelongsToEntry = (entryId: string, bundleId: string): boolean => {
  if (!entryId || !bundleId) {
    return false;
  }
  return bundleId === entryId || bundleId.startsWith(`${entryId}.`);
};

/** Owning top-level entry id for a tree item index (`entryId` or `entryId::...`). */
const owningEntryIdFromTreeIndex = (itemIndex: string): string => {
  const raw = String(itemIndex || '');
  const sep = raw.indexOf('::');
  return sep >= 0 ? raw.slice(0, sep) : raw;
};

export type SuiteTestTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string; id?: string; childrenRangeLabel?: string }
  | { type: 'test'; path: string; id: string; title?: string; parentPath?: string }
  | { type: 'server'; path: string; id: string; title?: string; parentPath?: string }
  | { type: 'suite'; path: string; id: string; title?: string; parentPath?: string };

interface SuiteTestTreeProps {
  groups: SuiteGroup[];
  hierarchyByEntryId: Record<string, SuiteTreeNode>;
  missingFiles: Set<string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };

  reportsById: Record<string, StepReportItem[]>;
  spilledReportIds?: Set<string>;
  loadingReportIds?: Set<string>;
  onRequestReports?: (nodeId: string) => void;
  runStateById: Record<string, StepStatus>;
  /** View-only status filter; does not change run data or exports. */
  statusFilter?: ReportStatusFilter;
  /** Bundle ids of mock servers listed twice in the same suite file. */
  duplicateServerIds?: Set<string>;
  onStatusFilterChange?: (next: ReportStatusFilter) => void;

  onRunTargets: (target: string) => void | Promise<void>;
  /** Logs-only core run (no UI panel updates). */
  onRunTargetsInCore?: (target: string) => void | Promise<void>;
  /** Load hierarchy for a top-level entry when the user expands it. */
  onRequestHierarchy?: (entryId: string) => void;
  /** When this key changes, expanded folders reset to the suite defaults. */
  suiteStructureKey?: string;
  onExpandedItemsChange?: (
    expandedItems: string[],
    items: Record<string, TreeItem<SuiteTestTreeItemData>>,
  ) => void;
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
        isFolder: true,
        children: [],
        // Top-level entries start as suite folders; hierarchy load resolves test vs suite.
        data: { type: 'suite', path: entry.path, id },
      };
    });
    // If there is only one group in the suite, show its entries directly
    // under the root to avoid an unnecessary intermediate group level in the UI.
    if (groups.length === 1) {
      // don't create a group node; entries will be direct children of root
    } else {
      items[groupId] = {
        index: groupId,
        isFolder: true,
        children: childIds,
        data: { type: 'group', label: group.label, id: createSuiteNodeId([idx]) },
      };
      groupIds.push(groupId);
    }
  });

  // If there's only one group, place its entry ids directly under the root;
  // otherwise the root contains group nodes.
  const rootChildren = groups.length === 1 ? groups[0].entries.map((e) => e.id || ensureEntryId(e.path)) : groupIds;
  items['suite-root'] = {
    index: 'suite-root',
    isFolder: true,
    children: rootChildren,
    data: { type: 'root', label: 'Suite' },
  };

  return { items, allPaths, groupIds };
};

/** Default expanded ids: root open, and every YAML group folder open. */
export function buildDefaultExpandedSuiteIds(groups: SuiteGroup[]): string[] {
  const ids: string[] = ['suite-root'];
  if (groups.length > 1) {
    for (let idx = 0; idx < groups.length; idx++) {
      ids.push(`group-${idx + 1}`);
    }
  }
  return ids;
}

/** Keep user-expanded rows when the tree gains items; drop ids that no longer exist. */
export function reconcileExpandedSuiteItems(
  prev: readonly string[],
  validItemIds: ReadonlySet<string>,
  defaultExpandedItems: readonly string[],
  options?: { mergeDefaults?: boolean },
): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const id of prev) {
    if (validItemIds.has(id) && !seen.has(id)) {
      next.push(id);
      seen.add(id);
    }
  }
  if (options?.mergeDefaults !== false) {
    for (const id of defaultExpandedItems) {
      if (validItemIds.has(id) && !seen.has(id)) {
        next.push(id);
        seen.add(id);
      }
    }
  }
  return next.length > 0 ? next : [...defaultExpandedItems];
}

/** Collect every expandable tree id (groups, entries, nested suite/group/test nodes). */
export function collectSuiteExpandableIds(
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
): string[] {
  const ids = new Set<string>(['suite-root']);
  const collect = (parentId: string, nodes: any[]) => {
    for (let idx = 0; idx < (nodes || []).length; idx++) {
      const n = nodes[idx];
      if (!n || typeof n !== 'object') {
        continue;
      }
      const baseId = typeof n.id === 'string' && n.id ? n.id : `${idx}|${n.kind}`;
      const uiId = `${parentId}::${baseId}`;
      if (n.kind === 'group') {
        if (Array.isArray(nodes) && nodes.length === 1) {
          collect(parentId, n.children || []);
          continue;
        }
        ids.add(uiId);
        collect(uiId, n.children || []);
        continue;
      }
      if (n.kind === 'suite' || n.kind === 'test' || n.kind === 'server') {
        ids.add(uiId);
        if (n.kind === 'suite') {
          collect(uiId, suiteTreeChildren(n));
        }
      }
    }
  };

  groups.forEach((group, idx) => {
    if (groups.length > 1) {
      ids.add(`group-${idx + 1}`);
    }
    group.entries.forEach((entry) => {
      ids.add(entry.id);
      const root = hierarchyByEntryId[entry.id] as any;
      if (root && typeof root === 'object' && root.kind === 'suite') {
        collect(entry.id, suiteTreeChildren(root));
      }
    });
  });

  return Array.from(ids);
}

/** Build the full react-complex-tree item map once per groups/hierarchy change. */
export function buildSuiteTestTreeItems(
  groups: SuiteGroup[],
  hierarchyByEntryId: Record<string, SuiteTreeNode>,
  baseItems: Record<string, TreeItem<SuiteTestTreeItemData>>,
): Record<string, TreeItem<SuiteTestTreeItemData>> {
  const items: Record<string, TreeItem<SuiteTestTreeItemData>> = { ...baseItems };

  // Resolve each top-level suite entry to either a suite or a test.
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    for (let ei = 0; ei < group.entries.length; ei++) {
      const entry = group.entries[ei];
      const entryItem = items[entry.id];
      if (!entryItem) {
        continue;
      }
      const hierarchy = hierarchyByEntryId[entry.id] as any;
      const entryId = entry.id;

      if (!hierarchy || typeof hierarchy !== 'object') {
        continue;
      }

      const isSuite = hierarchy.kind === 'suite';

      if (!isSuite) {
        const isServer = hierarchy.kind === 'server';
        items[entry.id] = {
          ...entryItem,
          isFolder: !isServer,
          children: [],
          data: {
            type: isServer ? 'server' : 'test',
            path: entry.path,
            id: entryId,
            title: (hierarchy as any)?.title,
            parentPath: '',
          },
        };
        continue;
      }

      items[entry.id] = {
        ...entryItem,
        isFolder: true,
        children: [],
        data: { type: 'suite', path: entry.path, id: entryId, title: (hierarchy as any)?.title, parentPath: '' },
      };
    }
  }

  const pushHierarchy = (
    ownerPath: string,
    parent: string,
    nodes: SuiteTreeNode[],
    outChildren: string[],
  ) => {
    for (let idx = 0; idx < (nodes || []).length; idx++) {
      const n = (nodes as any)[idx];
      if (!n) {
        continue;
      }

      const baseId = typeof n.id === 'string' && n.id ? n.id : `${idx}|${n.kind}`;
      const uiId = `${parent}::${baseId}`;

      if (n.kind === 'group') {
        if (Array.isArray(nodes) && nodes.length === 1) {
          pushHierarchy(ownerPath, parent, n.children, outChildren);
          continue;
        }

        const gid = uiId;
        const childIds2: string[] = [];
        items[gid] = { index: gid, isFolder: true, children: childIds2, data: { type: 'group', label: n.label, id: baseId } };
        pushHierarchy(ownerPath, gid, n.children, childIds2);
        outChildren.push(gid);
        continue;
      }

      if (n.kind === 'test' || n.kind === 'server') {
        const path = n.path;
        const itemId = uiId;
        items[itemId] = {
          index: itemId,
          isFolder: n.kind === 'test',
          children: [],
          data: {
            type: n.kind === 'server' ? 'server' : 'test',
            path,
            id: baseId,
            title: (n as any).title,
            parentPath: ownerPath,
          },
        };
        outChildren.push(itemId);
        continue;
      }

      if (n.kind === 'suite') {
        const path = n.path;
        const itemId = uiId;
        const childIdsForSuite: string[] = [];
        items[itemId] = {
          index: itemId,
          isFolder: true,
          children: childIdsForSuite,
          data: { type: 'suite', path, id: baseId, title: (n as any).title, parentPath: ownerPath },
        };
        pushHierarchy(path, itemId, suiteTreeChildren(n), childIdsForSuite);
        outChildren.push(itemId);
        continue;
      }

      if (n.kind === 'missing') {
        const path = n.path;
        const itemId = uiId;
        items[itemId] = {
          index: itemId,
          isFolder: false,
          children: [],
          data: { type: 'test', path, id: baseId, parentPath: ownerPath },
        };
        outChildren.push(itemId);
        continue;
      }

      if (n.kind === 'cycle') {
        continue;
      }
    }
  };

  groups.forEach((group) => {
    group.entries.forEach((entry) => {
      const item = items[entry.id];
      if (!item) {
        return;
      }

      const hierarchy = hierarchyByEntryId[entry.id];
      const root = hierarchy as any;
      if (!root || typeof root !== 'object' || root.kind !== 'suite') {
        return;
      }

      const hierarchyChildren: string[] = [];
      pushHierarchy(entry.path, entry.id, suiteTreeChildren(root), hierarchyChildren);

      if (hierarchyChildren.length) {
        items[entry.id] = {
          ...items[entry.id],
          children: [...(items[entry.id].children || []), ...hierarchyChildren],
          isFolder: true,
        };
      }
    });
  });

  return applyGroupChildrenRangeLabels(items);
}

const SuiteTestTree = forwardRef<SuiteTestTreeHandle, SuiteTestTreeProps>(function SuiteTestTree({
  groups,
  hierarchyByEntryId,
  missingFiles,
  statusIconFor,
  reportsById,
  spilledReportIds,
  loadingReportIds,
  onRequestReports,
  runStateById,
  statusFilter = 'all',
  duplicateServerIds,
  onStatusFilterChange,
  onRunTargets,
  onRunTargetsInCore,
  onRequestHierarchy,
  suiteStructureKey,
  onExpandedItemsChange,
}, ref) {
  const base = useMemo(() => buildBaseTestTree(groups), [groups]);
  const defaultExpandedItems = useMemo(() => buildDefaultExpandedSuiteIds(groups), [groups]);
  const topLevelEntryIds = useMemo(() => {
    const ids = new Set<string>();
    groups.forEach((group) => {
      group.entries.forEach((entry) => {
        ids.add(entry.id);
      });
    });
    return ids;
  }, [groups]);
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpandedItems);
  const onExpandedItemsChangeRef = useRef(onExpandedItemsChange);
  onExpandedItemsChangeRef.current = onExpandedItemsChange;
  const treeItemsRef = useRef<Record<string, TreeItem<SuiteTestTreeItemData>>>({});
  const suiteStructureKeyRef = useRef<string | undefined>(undefined);

  const syncExpandedItems = useCallback((
    next: string[],
    items: Record<string, TreeItem<SuiteTestTreeItemData>> = treeItemsRef.current,
  ) => {
    onExpandedItemsChangeRef.current?.(next, items);
  }, []);

  useEffect(() => {
    if (suiteStructureKeyRef.current === suiteStructureKey) {
      return;
    }
    suiteStructureKeyRef.current = suiteStructureKey;
    setExpandedItems(defaultExpandedItems);
    syncExpandedItems(defaultExpandedItems);
  }, [suiteStructureKey, defaultExpandedItems, syncExpandedItems]);

  const collapseAll = useCallback(() => {
    setExpandedItems(defaultExpandedItems);
    syncExpandedItems(defaultExpandedItems);
  }, [defaultExpandedItems, syncExpandedItems]);

  useImperativeHandle(ref, () => ({ collapseAll }), [collapseAll]);

  const treeData = useMemo(
    () => ({ items: buildSuiteTestTreeItems(groups, hierarchyByEntryId, base.items) }),
    [base.items, groups, hierarchyByEntryId],
  );
  treeItemsRef.current = treeData.items;

  useEffect(() => {
    const validItemIds = new Set(Object.keys(treeData.items));
    setExpandedItems((prev) => {
      const next = reconcileExpandedSuiteItems(prev, validItemIds, defaultExpandedItems, {
        mergeDefaults: false,
      });
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      syncExpandedItems(next, treeData.items);
      return next;
    });
  }, [treeData.items, defaultExpandedItems, syncExpandedItems]);

  const reportsByIdRef = useRef(reportsById);
  const runStateByIdRef = useRef(runStateById);
  const spilledReportIdsRef = useRef(spilledReportIds);
  const loadingReportIdsRef = useRef(loadingReportIds);
  const onRequestReportsRef = useRef(onRequestReports);
  reportsByIdRef.current = reportsById;
  runStateByIdRef.current = runStateById;
  spilledReportIdsRef.current = spilledReportIds;
  loadingReportIdsRef.current = loadingReportIds;
  onRequestReportsRef.current = onRequestReports;

  const visibleItems = useMemo(() => {
    if (statusFilter === 'all') {
      return treeData.items;
    }
    return filterTreeItemsByStatus(
      treeData.items,
      'suite-root',
      statusFilter,
      (item) => {
        const data = item.data as SuiteTestTreeItemData | undefined;
        const itemIndex = String(item.index);
        if (!data) {
          return 'default';
        }
        if (data.type === 'root') {
          return 'default';
        }
        if (data.type === 'group') {
          const match = /^group-(\d+)$/.exec(itemIndex);
          if (match) {
            return ownRunStatus(runStateById, createSuiteNodeId([Number(match[1]) - 1]));
          }
          const bundleId = (data as { id?: string }).id;
          return ownRunStatus(runStateById, typeof bundleId === 'string' ? bundleId : undefined);
        }
        const itemBundleId = (data as { id?: string }).id;
        const ownerEntryId = owningEntryIdFromTreeIndex(itemIndex);
        const belongs =
          !itemBundleId || bundleIdBelongsToEntry(ownerEntryId, itemBundleId);
        if (!belongs) {
          return 'default';
        }
        return ownRunStatus(runStateById, itemBundleId || itemIndex);
      },
    );
  }, [treeData.items, statusFilter, runStateById]);

  const hasVisibleLeaves = useMemo(() => {
    if (statusFilter === 'all') {
      return true;
    }
    const root = visibleItems['suite-root'];
    return Array.isArray(root?.children) && root.children.length > 0;
  }, [statusFilter, visibleItems]);

  const handleExpand = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      const itemId = String(item.index);
      setExpandedItems((prev) => {
        const next = prev.includes(itemId) ? prev : [...prev, itemId];
        syncExpandedItems(next);
        return next;
      });
      if (onRequestHierarchy && topLevelEntryIds.has(itemId) && !hierarchyByEntryId[itemId]) {
        onRequestHierarchy(itemId);
      }
    },
    [hierarchyByEntryId, onRequestHierarchy, syncExpandedItems, topLevelEntryIds],
  );

  const handleCollapse = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      setExpandedItems((prev) => {
        const next = prev.filter((id) => id !== String(item.index));
        syncExpandedItems(next);
        return next;
      });
    },
    [syncExpandedItems]
  );

  // Icon status is own-id only: never roll up children into parents.
  const getGroupStatus = useCallback((groupItemId: string): StepStatus => {
    const match = /^group-(\d+)$/.exec(groupItemId);
    if (match) {
      return ownRunStatus(runStateByIdRef.current, createSuiteNodeId([Number(match[1]) - 1]));
    }
    const bundleId = (treeData.items[groupItemId]?.data as any)?.id;
    return ownRunStatus(runStateByIdRef.current, typeof bundleId === 'string' ? bundleId : undefined);
  }, [treeData.items]);

  const getGroupTargets = useCallback((groupItemId: string): string[] => {
    const match = /^group-(\d+)$/.exec(groupItemId);
    if (match) {
      const groupIndex = Number(match[1]) - 1;
      const group = groups[groupIndex];
      if (!group || group.entries.length === 0) {
        return [];
      }
      return [createSuiteNodeId([groupIndex])];
    }
    // Nested/imported group: run by its bundle id from tree data.
    const bundleId = (treeData.items[groupItemId]?.data as any)?.id;
    return typeof bundleId === 'string' && bundleId ? [bundleId] : [];
  }, [groups, treeData.items]);

  const renderItem = useCallback(({ item, context, arrow, children, depth }: any) => {
    const reportsById = reportsByIdRef.current;
    const runStateById = runStateByIdRef.current;
    const spilledReportIds = spilledReportIdsRef.current;
    const loadingReportIds = loadingReportIdsRef.current;
    const onRequestReports = onRequestReportsRef.current;
    const data = item.data as SuiteTestTreeItemData;

    // Prefer the explicit parentPath recorded in the tree node data.
    // This keeps relative label behavior stable even when the UI id doesn't
    // map 1:1 to a suite path (e.g. top-level suite entries).
    const isFileRow = data && (data.type === 'test' || data.type === 'suite' || data.type === 'server');
    const displayPath = isFileRow ? suiteTreeItemDisplayName(data) : undefined;

    if (data.type === 'group' || data.type === 'root') {
      const itemId = String(item.index);
      const groupTargets = data.type === 'group' ? getGroupTargets(itemId) : [];
      const hasTargets = groupTargets.length > 0;
      return (
        <SuiteTestGroupItem
          item={item}
          context={context}
          depth={depth}
          arrow={arrow}
          children={children}
          status={getGroupStatus(itemId)}
          statusIconFor={statusIconFor}
          canShowStatusIcon={data.type === 'group' || data.type === 'root'}
          showRunButton={data.type === 'group'}
          runButtonTitle="Run group"
          runDisabled={!hasTargets}
          onRun={() => hasTargets && onRunTargets(groupTargets[0])}
          onRunInCore={
            hasTargets && onRunTargetsInCore
              ? () => onRunTargetsInCore(groupTargets[0])
              : undefined
          }
        />
      );
    }

    const entryId = String(item.index);
    const itemBundleId = (data as any)?.id as string | undefined;
    const ownerEntryId = owningEntryIdFromTreeIndex(entryId);
    const belongs =
      !itemBundleId || bundleIdBelongsToEntry(ownerEntryId, itemBundleId);
    const status: StepStatus = data.type === 'server'
      ? 'default'
      : belongs
        ? ownRunStatus(runStateById, itemBundleId || entryId)
        : 'default';

    if (data.type === 'suite') {
      const effectiveTarget = itemBundleId || entryId;
      return (
        <SuiteSuiteFileItem
          item={item as any}
          context={context}
          depth={depth}
          arrow={arrow}
          children={children}
          missingFiles={missingFiles}
          statusIconFor={statusIconFor as any}
          status={status}
          onRun={effectiveTarget ? () => onRunTargets(effectiveTarget) : undefined}
          onRunInCore={
            effectiveTarget && onRunTargetsInCore
              ? () => onRunTargetsInCore(effectiveTarget)
              : undefined
          }
          runButtonTitle="Run suite"
          runDisabled={!effectiveTarget}
          displayPath={displayPath}
        />
      );
    }

    const testLeafId = itemBundleId;
    const canRunLeaf = typeof testLeafId === 'string' && !!testLeafId;
    const scoped = Boolean(testLeafId && belongs);
    const showReports = Boolean(scoped && context?.isExpanded && testLeafId);
    const stepReports = showReports
      ? (reportsById[testLeafId!] || EMPTY_STEP_REPORTS)
      : EMPTY_STEP_REPORTS;
    const reportSpilled = Boolean(testLeafId && spilledReportIds?.has(testLeafId));
    const reportLoading = Boolean(testLeafId && loadingReportIds?.has(testLeafId));

    return (
      <SuiteTestFileItem
        item={item as any}
        context={context}
        depth={depth}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        status={status}
        stepReports={stepReports}
        reportSpilled={reportSpilled}
        reportLoading={reportLoading}
        onRequestReports={
          reportSpilled && testLeafId && onRequestReports
            ? () => onRequestReports(testLeafId)
            : undefined
        }
        onRun={data.type !== 'server' && canRunLeaf ? () => onRunTargets(testLeafId!) : undefined}
        onRunInCore={
          data.type !== 'server' && canRunLeaf && onRunTargetsInCore
            ? () => onRunTargetsInCore(testLeafId!)
            : undefined
        }
        runButtonTitle={data.type === 'server' ? 'Run server' : 'Run test'}
        runDisabled={!canRunLeaf}
        displayPath={displayPath}
        duplicateServer={Boolean(itemBundleId && duplicateServerIds?.has(itemBundleId))}
      />
    );
  }, [
    getGroupStatus,
    getGroupTargets,
    missingFiles,
    onRunTargets,
    onRunTargetsInCore,
    duplicateServerIds,
    statusIconFor,
  ]);
  return (
    <>
      {!hasVisibleLeaves ? (
        <ReportEmptyFilterPlaceholder
          filter={statusFilter}
          onShowAll={() => onStatusFilterChange?.('all')}
        />
      ) : (
    <ControlledTreeEnvironment
      items={visibleItems}
      renderDepthOffset={TREE_DEPTH_OFFSET}
      getItemTitle={(item) => {
        const data = item.data as SuiteTestTreeItemData;
        // Show the id in the accessible/title string for all node kinds.
        if (data?.type === 'test' || data?.type === 'suite' || data?.type === 'server') {
          const id = (data as any).id || String(item.index);
          return `${data.path} [${id}]`;
        }
        if (data?.type === 'root' || data?.type === 'group') {
          const id = String(item.index);
          return `${(data as any).label} [${id}]`;
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
      onSelectItems={() => { }}
      renderItemArrow={({ item, context }) => (
        <TreeFolderArrow
          isFolder={!!item.isFolder}
          isExpanded={context.isExpanded}
          arrowProps={context.arrowProps}
        />
      )}
      renderItem={renderItem}
      renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
      renderItemsContainer={({ children, containerProps }) => (
        <ul
          {...containerProps}
          className={['tree-list', containerProps.className].filter(Boolean).join(' ')}
          style={containerProps.style}
        >
          {children}
        </ul>
      )}
      renderDragBetweenLine={({ lineProps, draggingPosition }) => (
        <div
          {...lineProps}
          style={treeDragBetweenLineStyle(lineProps.style, draggingPosition.depth, 0)}
          className={['tree-drop-line', lineProps.className].filter(Boolean).join(' ')}
        />
      )}
    >
      <Tree treeId="suite-test-tree" rootItem="suite-root" treeLabel="Suite structure" />
    </ControlledTreeEnvironment>
      )}
    </>
  );
});

export default React.memo(SuiteTestTree);
