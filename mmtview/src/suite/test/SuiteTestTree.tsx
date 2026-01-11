import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ControlledTreeEnvironment, Tree, TreeItem } from 'react-complex-tree';
import SuiteTestGroupItem from './SuiteTestGroupItem';
import SuiteTestFileItem from './SuiteTestFileItem';
import SuiteSuiteFileItem from './SuiteSuiteFileItem';
import { StepStatus, SuiteGroup } from '../types';
import { StepReportItem } from '../../shared/TestStepReportPanel';
import { SuiteTreeNode } from './suiteHierarchy';

const randomId = () => {
  try {
    const anyCrypto = (globalThis as any)?.crypto;
    if (anyCrypto && typeof anyCrypto.randomUUID === 'function') {
      return anyCrypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export type SuiteTestTreeItemData =
  | { type: 'root'; label: string }
  | { type: 'group'; label: string }
  | { type: 'test'; path: string; leafId: string }
  | { type: 'suite'; path: string };

interface SuiteTestTreeProps {
  groups: SuiteGroup[];
  hierarchyByEntryPath: Record<string, SuiteTreeNode[]>;
  missingFiles: Set<string>;
  stepStatuses: Record<string, StepStatus | 'running'>;
  lastRunIdByEntryId: Record<string, string>;
  statusIconFor: (status: StepStatus | 'running') => { icon: string; color: string; title: string };

  leafReportsByLeafId: Record<string, StepReportItem[]>;
  leafRunStateByLeafId: Record<string, 'idle' | 'running' | 'passed' | 'failed' | 'cancelled'>;

  onRunTargets: (targets: string[]) => void;
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
        data: { type: 'suite', path: entry.path },
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
  leafReportsByLeafId,
  leafRunStateByLeafId,
  onRunTargets,
}) => {
  const base = useMemo(() => buildBaseTestTree(groups), [groups]);
  const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);
  const importedIdMap = useMemo(() => new Map<string, string>(), []);

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
        const leafId = `${gi}:${ei}`;
        const hierarchy = hierarchyByEntryPath[entry.path];
        const isSuite = Array.isArray(hierarchy);

        if (!isSuite) {
          items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'test', path: entry.path, leafId } };
          continue;
        }

        items[entry.id] = { ...entryItem, isFolder: true, children: [], data: { type: 'suite', path: entry.path } };
      }
    }

    groups.forEach((group) => {
      group.entries.forEach((entry) => {
        const item = items[entry.id];
        if (!item) {
          return;
        }

        const hierarchy = hierarchyByEntryPath[entry.path];
        if (!Array.isArray(hierarchy)) {
          return;
        }

        const isExpanded = expandedItems.includes(entry.id);
        if (!isExpanded) {
          return;
        }

        const effectiveHierarchy = hierarchy ?? [];

        const hierarchyChildren: string[] = [];
        const pushHierarchy = (parent: string, nodes: SuiteTreeNode[]) => {
          nodes.forEach((n, idx) => {
            // Use a random id per imported node instance to prevent collisions.
            // Key is structural (parent + idx + kind + path) so it is stable across renders.
            const key = `${parent}|${idx}|${n.kind}|${(n as any).path ?? ''}|${(n as any).label ?? ''}`;
            let baseId = importedIdMap.get(key);
            if (!baseId) {
              baseId = `import:${randomId()}`;
              importedIdMap.set(key, baseId);
            }
            if (n.kind === 'group') {
              const gid = `${baseId}:group:${n.label}`;
              const childIds2: string[] = [];
              items[gid] = { index: gid, isFolder: true, children: childIds2, data: { type: 'group', label: n.label } };
              pushHierarchy(gid, n.children);
              hierarchyChildren.push(gid);
              return;
            }

            if (n.kind === 'test') {
              const path = n.path;
              const nodeId = `${baseId}:test:${path}`;
              items[nodeId] = { index: nodeId, isFolder: true, children: [], data: { type: 'test', path, leafId: nodeId } };
              hierarchyChildren.push(nodeId);
              return;
            }

            if (n.kind === 'suite') {
              const path = n.path;
              const nodeId = `${baseId}:suite:${path}`;
              items[nodeId] = { index: nodeId, isFolder: true, children: [], data: { type: 'suite', path } };
              hierarchyChildren.push(nodeId);
              if (Array.isArray(n.children) && n.children.length) {
                pushHierarchy(nodeId, n.children);
              }
              return;
            }

            if (n.kind === 'missing') {
              const path = n.path;
              const nodeId = `${baseId}:missing:${path}`;
              items[nodeId] = { index: nodeId, isFolder: false, children: [], data: { type: 'test', path, leafId: nodeId } };
              hierarchyChildren.push(nodeId);
              return;
            }

            if (n.kind === 'cycle') {
              return;
            }
          });
        };

        pushHierarchy(entry.id, effectiveHierarchy);

        // Only show imported children when expanded.
        if (hierarchyChildren.length) {
          items[entry.id] = { ...items[entry.id], children: [...(items[entry.id].children || []), ...hierarchyChildren], isFolder: true };
        }
      });
    });

    return { items };
  }, [base.items, expandedItems, groups, hierarchyByEntryPath, importedIdMap]);

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

  const getGroupStatus = useCallback((): StepStatus => 'default', []);

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
    return group.entries.map((_, ei) => `${groupIndex}:${ei}`);
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
          onRun={() => hasTargets && onRunTargets(groupTargets)}
        />
      );
    }

    const entryId = String(item.index);
    const computedStatus = (() => {
      // Imported nodes use the same UI; they may not participate in run status.
      // For now, non-root tests show default status unless they are leafId tracked.

      const runId = lastRunIdByEntryId[entryId];
      if (runId && stepStatuses[runId]) {
        return stepStatuses[runId] as StepStatus;
      }

      // If we have a leafId-derived run state, prefer it for the visible icon.
      // (Only applies to root suite entries, not imported leaves.)
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        for (let ei = 0; ei < group.entries.length; ei++) {
          const entry = group.entries[ei];
          if (entry.id === entryId) {
            const leafId = `${gi}:${ei}`;
            const leafState = leafRunStateByLeafId[leafId];
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
      const suiteLeafId = (() => {
        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];
          for (let ei = 0; ei < group.entries.length; ei++) {
            const entry = group.entries[ei];
            if (entry.id === entryId) {
              return `${gi}:${ei}`;
            }
          }
        }
        return '';
      })();
      // Imported suites are runnable too; use their tree id as the target.
      const isImportedSuite = !suiteLeafId && entryId.startsWith('import:');
      const suiteImportedTarget = isImportedSuite ? entryId : '';
      const effectiveTarget = suiteLeafId || suiteImportedTarget;
      const effectiveRunHandler = effectiveTarget ? () => onRunTargets([effectiveTarget]) : undefined;
      return (
        <SuiteSuiteFileItem
          item={item as any}
          context={context}
          arrow={arrow}
          children={children}
          missingFiles={missingFiles}
          statusIconFor={statusIconFor as any}
          status={suiteStatus}
          leafId={suiteLeafId}
          leafRunStateByLeafId={leafRunStateByLeafId}
          onRun={effectiveRunHandler}
          runButtonTitle="Run suite"
          runDisabled={!effectiveTarget}
        />
      );
    }

    const testLeafId = (data as any)?.leafId as string | undefined;
    const isTopLevelLeaf = typeof testLeafId === 'string' && /^\d+:\d+$/.test(testLeafId);
    const isImportedLeaf = typeof testLeafId === 'string' && testLeafId.startsWith('import:');
    const canRunLeaf = isTopLevelLeaf || isImportedLeaf;
    const handleRun = canRunLeaf ? () => onRunTargets([testLeafId!]) : undefined;

    return (
      <SuiteTestFileItem
        item={item as any}
        context={context}
        arrow={arrow}
        children={children}
        missingFiles={missingFiles}
        statusIconFor={statusIconFor as any}
        status={computedStatus}
        leafReportsByLeafId={leafReportsByLeafId}
        leafRunStateByLeafId={leafRunStateByLeafId}
        onRun={handleRun}
        runButtonTitle="Run test"
        runDisabled={!canRunLeaf}
      />
    );
  };
  console.log('Rendering SuiteTestTree with treeData:', treeData);
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
