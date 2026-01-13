import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItem } from 'react-complex-tree';
import SuiteTestGroupItem from './SuiteTestGroupItem';
import SuiteTestFileItem from './SuiteTestFileItem';
import SuiteSuiteFileItem from './SuiteSuiteFileItem';
import { StepStatus, SuiteGroup } from '../types';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { SuiteTreeNode } from './suiteHierarchy';

export type SuiteTestTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string }
  | { type: 'test'; path: string; id: string }
  | { type: 'suite'; path: string; id: string };

interface SuiteTestTreeProps {
  groups: SuiteGroup[];
  hierarchyByEntryPath: Record<string, SuiteTreeNode>;
  missingFiles: Set<string>;
  stepStatuses: Record<string, StepStatus | 'running'>;
  lastRunIdByEntryId: Record<string, string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };

  reportsById: Record<string, StepReportItem[]>;
  runStateById: Record<string, 'idle' | 'running' | 'passed' | 'failed' | 'cancelled'>;

  onRunTargets: (target: string) => void;
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
        // Top-level suite entries are unknown until importTree resolves docType.
        // They can later become either a suite or a test.
        data: { type: 'suite', path: entry.path, id },
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
          items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'test', path: entry.path, id: entryId } };
          continue;
        }

        items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'suite', path: entry.path, id: entryId } };
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
        const pushHierarchy = (parent: string, nodes: SuiteTreeNode[]) => {
          nodes.forEach((n, idx) => {
            const nodeId = typeof (n as any).id === 'string' && (n as any).id ? (n as any).id : `${parent}|${idx}|${n.kind}`;
            if (n.kind === 'group') {
              const gid = nodeId;
              const childIds2: string[] = [];
              items[gid] = { index: gid, isFolder: true, children: childIds2, data: { type: 'group', label: n.label } };
              pushHierarchy(gid, n.children);
              hierarchyChildren.push(gid);
              return;
            }

            if (n.kind === 'test') {
              const path = n.path;
              const itemId = nodeId;
              items[itemId] = { index: itemId, isFolder: true, children: [], data: { type: 'test', path, id: itemId } };
              hierarchyChildren.push(itemId);
              return;
            }

            if (n.kind === 'suite') {
              const path = n.path;
              const itemId = nodeId;
              items[itemId] = { index: itemId, isFolder: true, children: [], data: { type: 'suite', path, id: itemId } };
              hierarchyChildren.push(itemId);
              if (Array.isArray(n.children) && n.children.length) {
                pushHierarchy(itemId, n.children);
              }
              return;
            }

            if (n.kind === 'missing') {
              const path = n.path;
              const itemId = nodeId;
              items[itemId] = { index: itemId, isFolder: false, children: [], data: { type: 'test', path, id: itemId } };
              hierarchyChildren.push(itemId);
              return;
            }

            if (n.kind === 'cycle') {
              return;
            }
          });
        };

        pushHierarchy(entry.id, Array.isArray(root.children) ? root.children : []);

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

  const getGroupStatus = useCallback((groupItemId: string): StepStatus => {
    const match = /^group-(\d+)$/.exec(groupItemId);
    if (!match) {
      return 'default';
    }
    const groupIndex = Number(match[1]) - 1;
    const group = groups[groupIndex];
    if (!group) {
      return 'default';
    }
    // Determine visible status per entry. Prefer explicit stepStatuses (from last run)
    // then fall back to runStateById. Map internal states to StepStatus values
      // and aggregate with priority: failed > cancelled > running > pending > passed > default.
    let anyFailed = false;
    let anyCancelled = false;
    let anyRunning = false;
    let anyPending = false;
    let allPassed = group.entries.length > 0;
    let anySeen = false;

    for (const entry of group.entries) {
      const id = entry.id;

      // Prefer stepStatuses for the last run if available. Also accept UI-updates
      // that may have placed a pending status keyed by the entry id itself.
      const runId = lastRunIdByEntryId && lastRunIdByEntryId[entry.id];
      let explicitStatus = runId ? (stepStatuses && stepStatuses[runId]) : undefined;
      if (!explicitStatus && stepStatuses && stepStatuses[entry.id]) {
        explicitStatus = stepStatuses[entry.id];
      }

      let visible: StepStatus | 'running' | undefined = undefined;
      if (explicitStatus && explicitStatus !== 'pending') {
        // If explicit status exists and is not a transient 'pending', use it.
        visible = explicitStatus as any;
      } else {
        // Either no explicit status or it's a UI 'pending' marker.
        const state = runStateById && runStateById[id];
        if (state === 'running') {
          visible = 'running';
        } else if (state === 'passed') {
          visible = 'passed';
        } else if (state === 'failed') {
          visible = 'failed';
        } else if (state === 'cancelled') {
          visible = 'cancelled';
        } else if (explicitStatus === 'pending') {
          // No concrete leaf state yet, but UI explicitly marked pending.
          visible = 'pending';
        } else {
          visible = undefined;
        }
      }

      if (typeof visible === 'string') {
        anySeen = true;
      }

      if (visible === 'failed') {
        anyFailed = true;
      }
      if (visible === 'cancelled') {
        anyCancelled = true;
      }
      if (visible === 'running') {
        anyRunning = true;
      }
      if (visible === 'pending') {
        anyPending = true;
      }
      if (visible !== 'passed') {
        allPassed = false;
      }
    }

    if (anyFailed) {
      return 'failed';
    }
    if (anyCancelled) {
      return 'cancelled';
    }
    if (anyRunning) {
      return 'running';
    }
    if (anyPending) {
      return 'pending';
    }
    if (allPassed && anySeen) {
      return 'passed';
    }
    // If no visible states were observed (all entries are default/idle/unknown), keep 'default'.
    return 'default';
  }, [groups, runStateById, stepStatuses, lastRunIdByEntryId]);

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
    const computedStatus = (() => {
      // Imported nodes use the same UI; they may not participate in run status.
      // For now, non-root tests show default status unless tracked.

      const runId = lastRunIdByEntryId[entryId];
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

      return (stepStatuses[entryId] ?? 'default') as StepStatus;
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
        />
      );
    }

    const testLeafId = (data as any)?.id as string | undefined;
    const canRunLeaf = typeof testLeafId === 'string' && !!testLeafId;
      const handleRun = canRunLeaf ? () => onRunTargets(testLeafId!) : undefined;

    return (
      <SuiteTestFileItem
        item={item as any}
        context={context}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        status={computedStatus}
        reportsById={reportsById}
        runStateById={runStateById}
        onRun={handleRun}
        runButtonTitle="Run test"
        runDisabled={!canRunLeaf}
      />
    );
  };
  return (
    <ControlledTreeEnvironment
      items={treeData.items}
      getItemTitle={(item) => {
        const data = item.data as SuiteTestTreeItemData;
        if (data?.type === 'test' || data?.type === 'suite') {
          return data.path;
        }
        if (data?.type === 'root' || data?.type === 'group') {
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
