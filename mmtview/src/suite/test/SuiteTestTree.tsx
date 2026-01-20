import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItem } from 'react-complex-tree';
import SuiteTestGroupItem from './SuiteTestGroupItem';
import SuiteTestFileItem from './SuiteTestFileItem';
import SuiteSuiteFileItem from './SuiteSuiteFileItem';
import { SuiteGroup } from '../types';
import { StepStatus } from '../../shared/types';
import { aggregateLeafIds, aggregateStatuses, leafVisibleStatus } from '../../shared/Common';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { SuiteTreeNode } from './suiteHierarchy';

const relativeToParentDir = (childPath: string, parentPath: string): string => {
  if (!childPath || !parentPath) {
    return childPath;
  }
  const normalize = (p: string) => p.replace(/\\/g, '/');
  const child = normalize(childPath);
  const parent = normalize(parentPath);

  const parentDir = parent.includes('/') ? parent.slice(0, parent.lastIndexOf('/') + 1) : '';
  if (parentDir && child.startsWith(parentDir)) {
    return child.slice(parentDir.length);
  }

  // If we can't compute a clean relative label, fall back.
  return childPath;
};

const basename = (p: string): string => {
  const s = (p || '').replace(/\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? s.slice(idx + 1) : s;
};

export type SuiteTestTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string; id?: string }
  | { type: 'test'; path: string; id: string; title?: string; parentPath?: string }
  | { type: 'suite'; path: string; id: string; title?: string; parentPath?: string };

interface SuiteTestTreeProps {
  groups: SuiteGroup[];
  hierarchyByEntryPath: Record<string, SuiteTreeNode>;
  missingFiles: Set<string>;
  stepStatuses: Record<string, StepStatus | 'running'>;
  lastRunIdByEntryId: Record<string, string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };

  reportsById: Record<string, StepReportItem[]>;
  runStateById: Record<string, StepStatus>;

  onRunTargets: (target: string) => void;
}

const collectDescendantLeafIds = (
  items: Record<string, TreeItem<SuiteTestTreeItemData>>,
  rootItemId: string
): string[] => {
  const leafIds: string[] = [];
  const stack = [rootItemId];
  while (stack.length) {
    const currentId = String(stack.pop());
    const node = items[currentId];
    if (!node) {
      continue;
    }
    const data = node.data as any;
    if (data && (data.type === 'test' || data.type === 'suite')) {
      if (typeof data.id === 'string' && data.id) {
        leafIds.push(data.id);
      }
    }
    if (Array.isArray(node.children) && node.children.length) {
      for (const childId of node.children) {
        stack.push(String(childId));
      }
    }
  }
  return leafIds;
};

const collectImportedGroupLeafIds = (items: Record<string, TreeItem<SuiteTestTreeItemData>>, groupItemId: string): string[] => {
  const importedItem = items[groupItemId];
  if (!importedItem) {
    return [];
  }
  return collectDescendantLeafIds(items, groupItemId);
};

const buildLeafVisibleGetter = (args: {
  runStateById: Record<string, StepStatus>;
  lastRunIdByEntryId: Record<string, string>;
  stepStatuses: Record<string, StepStatus | 'running'>;
}) => {
  return (leafId: string): StepStatus | undefined => {
    const runId = args.lastRunIdByEntryId && args.lastRunIdByEntryId[leafId];
    const explicitStatus = runId ? (args.stepStatuses && args.stepStatuses[runId]) : undefined;
    return leafVisibleStatus({
      leafState: args.runStateById && args.runStateById[leafId],
      explicitRunStatus: (explicitStatus as any) as StepStatus | undefined,
      isPending: Boolean(args.stepStatuses && args.stepStatuses[leafId] === 'pending'),
    });
  };
};

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
        // Top-level suite entries are unknown until importTree resolves docType.
        // They can later become either a suite or a test.
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
        data: { type: 'group', label: group.label },
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

const SuiteTestTree: React.FC<SuiteTestTreeProps> = ({
  groups,
  hierarchyByEntryPath,
  missingFiles,
  stepStatuses,
  lastRunIdByEntryId,
  statusIconFor,
  reportsById,
  runStateById,
  onRunTargets,
}) => {
  const base = useMemo(() => buildBaseTestTree(groups), [groups]);
  const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);

  // Expand base group nodes by default — one-time on mount.
  useEffect(() => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      base.groupIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, [base.groupIds]);

  // Auto-expand imported suite entries and their nested group/suite nodes
  // when a hierarchy is attached for an entry path.
  useEffect(() => {
    const idsToAdd = new Set<string>();
    for (const group of groups) {
      for (const entry of group.entries) {
        const root = (hierarchyByEntryPath as any)?.[entry.path];
        if (!root || typeof root !== 'object' || root.kind !== 'suite') {
          continue;
        }
        // ensure the entry itself is expanded so imported children are visible
        idsToAdd.add(entry.id);

        // recursively collect UI ids (parent::child) for suite/group nodes
        // so auto-expand works with UI-scoped ids rather than core bundle ids.
        const collect = (parentId: string, nodes: any[]) => {
          for (let idx = 0; idx < (nodes || []).length; idx++) {
            const n = nodes[idx];
            if (!n || typeof n !== 'object') {
              continue;
            }
            const baseId = typeof n.id === 'string' && n.id ? n.id : `${idx}|${n.kind}`;
            const uiId = `${parentId}::${baseId}`;
            if (n.kind === 'group' || n.kind === 'suite') {
              idsToAdd.add(uiId);
              if (Array.isArray(n.children) && n.children.length) {
                collect(uiId, n.children);
              }
            }
          }
        };
        collect(entry.id, Array.isArray(root.children) ? root.children : []);
      }
    }
    if (idsToAdd.size) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        idsToAdd.forEach((id) => next.add(id));
        return Array.from(next);
      });
    }
  }, [hierarchyByEntryPath, groups]);

  const treeData = useMemo(() => {
    const items: Record<string, TreeItem<SuiteTestTreeItemData>> = { ...base.items };

    // Resolve each top-level suite entry to either a suite or a test.
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      for (let ei = 0; ei < group.entries.length; ei++) {
        const entry = group.entries[ei];
        const entryItem = items[entry.id];
        if (!entryItem) {
          continue;
        }
        const hierarchy = hierarchyByEntryPath[entry.path] as any;
        const isSuite = !!hierarchy && typeof hierarchy === 'object' && hierarchy.kind === 'suite';
        const entryId = entry.id;

        if (!isSuite) {
          // Top-level entries are relative to the suite file itself (this file).
          items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'test', path: entry.path, id: entryId, title: (hierarchy as any)?.title, parentPath: '' } };
          continue;
        }

        // Top-level imported suite entry. Its children should be displayed relative to this suite file.
        items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'suite', path: entry.path, id: entryId, title: (hierarchy as any)?.title, parentPath: '' } };
      }
    }

    groups.forEach((group) => {
      group.entries.forEach((entry) => {
        const item = items[entry.id];
        if (!item) {
          return;
        }

        const hierarchy = hierarchyByEntryPath[entry.path];
        const root = hierarchy as any;
        if (!root || typeof root !== 'object' || root.kind !== 'suite') {
          return;
        }

        const isExpanded = expandedItems.includes(entry.id);
        if (!isExpanded) {
          return;
        }

        const hierarchyChildren: string[] = [];

        const pushHierarchy = (parent: string, nodes: SuiteTreeNode[], outChildren: string[]) => {
          for (let idx = 0; idx < (nodes || []).length; idx++) {
            const n = (nodes as any)[idx];
            if (!n) continue;

            const baseId = typeof n.id === 'string' && n.id ? n.id : `${idx}|${n.kind}`;
            const uiId = `${parent}::${baseId}`;

            if (n.kind === 'group') {
              // If the suite's children array contains exactly one group, flatten
              // that group into the parent UI node so the UI doesn't show an
              // unnecessary single group level for imported suites.
              if (Array.isArray(nodes) && nodes.length === 1) {
                // recurse into the single group's children directly under parent
                pushHierarchy(parent, n.children, outChildren);
                continue;
              }

              const gid = uiId;
              const childIds2: string[] = [];
              items[gid] = { index: gid, isFolder: true, children: childIds2, data: { type: 'group', label: n.label, id: baseId } };
              // recurse and populate childIds2
              pushHierarchy(gid, n.children, childIds2);
              outChildren.push(gid);
              continue;
            }

            if (n.kind === 'test') {
              const path = n.path;
              const itemId = uiId;
              // Make imported test nodes expandable so users can toggle the report panel.
              items[itemId] = { index: itemId, isFolder: true, children: [], data: { type: 'test', path, id: baseId, title: (n as any).title, parentPath: parent } };
              outChildren.push(itemId);
              continue;
            }

            if (n.kind === 'suite') {
              const path = n.path;
              const itemId = uiId;
              const childIdsForSuite: string[] = [];
              items[itemId] = { index: itemId, isFolder: true, children: childIdsForSuite, data: { type: 'suite', path, id: baseId, title: (n as any).title, parentPath: parent } };
              // recurse to populate childIdsForSuite
              pushHierarchy(itemId, n.children, childIdsForSuite);
              outChildren.push(itemId);
              continue;
            }

            if (n.kind === 'missing') {
              const path = n.path;
              const itemId = uiId;
              items[itemId] = { index: itemId, isFolder: false, children: [], data: { type: 'test', path, id: baseId, parentPath: parent } };
              outChildren.push(itemId);
              continue;
            }

            if (n.kind === 'cycle') {
              // ignore cycles in UI
              continue;
            }
          }
        };

        pushHierarchy(entry.id, Array.isArray(root.children) ? root.children : [], hierarchyChildren);

        // Only show imported children when expanded.
        if (hierarchyChildren.length) {
          items[entry.id] = { ...items[entry.id], children: [...(items[entry.id].children || []), ...hierarchyChildren], isFolder: true };
        }
      });
    });

    return { items };
  }, [base.items, expandedItems, groups, hierarchyByEntryPath]);

  const handleExpand = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      setExpandedItems((prev) => (prev.includes(String(item.index)) ? prev : [...prev, String(item.index)]));
    },
    []
  );

  const handleCollapse = useCallback(
    (item: TreeItem<SuiteTestTreeItemData>) => {
      setExpandedItems((prev) => prev.filter((id) => id !== String(item.index)));
    },
    []
  );

  // Precompute imported-group statuses based on the current tree items and run state.
  const importedGroupStatusMap = useMemo(() => {
    const map: Record<string, StepStatus> = {};
    const items = treeData.items;

    const getLeafVisible = buildLeafVisibleGetter({ runStateById, lastRunIdByEntryId, stepStatuses });

    const aggregate = (leafIds: string[]): StepStatus => {
      return aggregateLeafIds({ leafIds, getVisible: getLeafVisible });
    };

    for (const id of Object.keys(items)) {
      const item = items[id];
      const data = item?.data as any;
      if (!data || data.type !== 'group') continue;
      // skip top-level group-N entries
      if (/^group-(\d+)$/.test(String(id))) continue;
      // collect descendant leaf ids
      const leafIds: string[] = [];
      const stack = [...(item.children || [])];
      while (stack.length) {
        const cid = String(stack.pop());
        const child = items[cid];
        const cdata = child?.data as any;
        if (!child || !cdata) continue;
        if (cdata.type === 'test' || cdata.type === 'suite') {
          if (typeof cdata.id === 'string' && cdata.id) leafIds.push(cdata.id);
        }
        if (Array.isArray(child.children) && child.children.length) stack.push(...child.children);
      }
      map[id] = aggregate(leafIds);
    }
    return map;
  }, [treeData.items, runStateById, stepStatuses, lastRunIdByEntryId]);

  const getGroupStatus = (groupItemId: string): StepStatus => {
    const match = /^group-(\d+)$/.exec(groupItemId);
    const isTopLevel = !!match;
    if (isTopLevel) {
      const groupIndex = Number(match![1]) - 1;
      const group = groups[groupIndex];
      if (!group) return 'default';
      const leafIds = group.entries.map((e) => e.id).filter(Boolean);
      const statuses: Array<StepStatus | undefined> = [];
      for (const leafId of leafIds) {
        const runId = lastRunIdByEntryId && lastRunIdByEntryId[leafId];
        const explicitStatus = runId ? (stepStatuses && stepStatuses[runId]) : undefined;
        statuses.push(
          leafVisibleStatus({
            leafState: runStateById && runStateById[leafId],
            explicitRunStatus: (explicitStatus as any) as StepStatus | undefined,
            isPending: Boolean(stepStatuses && stepStatuses[leafId] === 'pending'),
          })
        );
      }
      return aggregateStatuses(statuses);
    }

    // Imported group nodes (nested suite groups): compute status from descendants
    // using the full tree data so we can show cancelled when stopping a run.
    const importedLeafIds = collectImportedGroupLeafIds(treeData.items, groupItemId);
    if (importedLeafIds.length) {
      const getLeafVisible = buildLeafVisibleGetter({ runStateById, lastRunIdByEntryId, stepStatuses });
      return aggregateLeafIds({ leafIds: importedLeafIds, getVisible: getLeafVisible });
    }

    return importedGroupStatusMap[groupItemId] || 'default';
  };

  const getGroupTargets = useCallback((groupItemId: string): string[] => {
    const match = /^group-(\d+)$/.exec(groupItemId);
    if (!match) {
      return [];
    }
    const groupIndex = Number(match[1]) - 1;
    const group = groups[groupIndex];
    if (!group) {
      return [];
    }
    // Group targeting uses entry ids.
    return group.entries.map((e) => e.id).filter((id): id is string => typeof id === 'string' && !!id);
  }, [groups]);

  const renderItem = ({ item, context, arrow, children }: any) => {
    const data = item.data as SuiteTestTreeItemData;

    // Prefer the explicit parentPath recorded in the tree node data.
    // This keeps relative label behavior stable even when the UI id doesn't
    // map 1:1 to a suite path (e.g. top-level suite entries).
    const parentPath = (data && (data.type === 'test' || data.type === 'suite')) ? (data as any).parentPath : undefined;
    const rawPath = (data && (data.type === 'test' || data.type === 'suite')) ? (data as any).path : undefined;
    const displayPath = (() => {
      if (!rawPath || typeof rawPath !== 'string') {
        return undefined;
      }

      // Prefer YAML title when present.
      const title = (data && (data.type === 'test' || data.type === 'suite')) ? (data as any).title : undefined;
      if (typeof title === 'string' && title.trim()) {
        return title.trim();
      }

      // Imported items: show the exact string as written in the parent suite list.
      // If we cannot compute a friendly label, fall back to just the filename.
      if (typeof parentPath === 'string' && parentPath) {
        const rel = relativeToParentDir(rawPath, parentPath);
        return rel && rel !== rawPath ? rel : basename(rawPath);
      }

      // Top-level suite entries: show filename only (avoids long noisy paths).
      return basename(rawPath);
    })();

    if (data.type === 'group' || data.type === 'root') {
      const itemId = String(item.index);
      const groupTargets = data.type === 'group' ? getGroupTargets(itemId) : [];
      const hasTargets = groupTargets.length > 0;
      return (
        <SuiteTestGroupItem
          item={item}
          context={context}
          arrow={arrow}
          children={children}
          getGroupStatus={getGroupStatus}
          statusIconFor={statusIconFor}
          canShowStatusIcon={data.type === 'group' || data.type === 'root'}
          showRunButton={data.type === 'group'}
          runButtonTitle="Run group"
          runDisabled={!hasTargets}
          onRun={() => hasTargets && onRunTargets(groupTargets[0])}
        />
      );
    }

    const entryId = String(item.index);
    const itemBundleId = (data as any)?.id as string | undefined;
    const computedStatus = (() => {
      // Imported nodes use the same UI; they may not participate in run status.
      // For now, non-root tests show default status unless tracked.

      const statusKey = itemBundleId || entryId;
      const runId = lastRunIdByEntryId[statusKey];
      if (runId && stepStatuses[runId]) {
        return stepStatuses[runId] as StepStatus;
      }

      // If we have an id-derived run state, prefer it for the visible icon.
      // (Only applies to root suite entries, not imported leaves.)
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        for (let ei = 0; ei < group.entries.length; ei++) {
          const entry = group.entries[ei];
          if (entry.id === entryId) {
            const id = entry.id;
            const leafState = id ? runStateById[id] : undefined;
            if (leafState === 'cancelled') {
              return 'cancelled' as any;
            }
            if (leafState === 'running') {
              return 'running' as any;
            }
            if (leafState === 'passed' || leafState === 'failed') {
              return leafState as any;
            }
          }
        }
      }

      return (stepStatuses[statusKey] ?? 'default') as StepStatus;
    })();

    if (data.type === 'suite') {
      const suiteStatus = computedStatus as any;
      const effectiveTarget = (data as any).id || entryId;
      const effectiveRunHandler = effectiveTarget ? () => onRunTargets(effectiveTarget) : undefined;
      return (
        <SuiteSuiteFileItem
          item={item as any}
          context={context}
          arrow={arrow}
          children={children}
          missingFiles={missingFiles}
          statusIconFor={statusIconFor as any}
          status={suiteStatus}
          id={(data as any).id || ''}
          runStateById={runStateById}
          onRun={effectiveRunHandler}
          runButtonTitle="Run suite"
          runDisabled={!effectiveTarget}
          displayPath={displayPath}
        />
      );
    }

    const testLeafId = (data as any)?.id as string | undefined;
    const canRunLeaf = typeof testLeafId === 'string' && !!testLeafId;
    const handleRun = canRunLeaf ? () => onRunTargets(testLeafId!) : undefined;

    // Ensure test leaf status reflects bundle-id keyed runState when available.
    const effectiveTestStatus = (() => {
      const leafState = testLeafId ? runStateById[testLeafId] : undefined;
      if (leafState === 'running') {
        return 'running' as any;
      }
      if (leafState === 'cancelled') {
        return 'cancelled' as any;
      }
      if (leafState === 'passed' || leafState === 'failed') {
        return leafState as any;
      }
      return computedStatus;
    })();

    return (
      <SuiteTestFileItem
        item={item as any}
        context={context}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        status={effectiveTestStatus}
        reportsById={reportsById}
        runStateById={runStateById}
        onRun={handleRun}
        runButtonTitle="Run test"
        runDisabled={!canRunLeaf}
        displayPath={displayPath}
      />
    );
  };
  return (
    <ControlledTreeEnvironment
      items={treeData.items}
      getItemTitle={(item) => {
        const data = item.data as SuiteTestTreeItemData;
        // Show the id in the accessible/title string for all node kinds.
        if (data?.type === 'test' || data?.type === 'suite') {
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
