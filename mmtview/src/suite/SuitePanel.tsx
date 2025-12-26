import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ControlledTreeEnvironment,
  DraggingPosition,
  DraggingPositionBetweenItems,
  DraggingPositionItem,
  Tree,
  TreeItem,
} from 'react-complex-tree';
import 'react-complex-tree/lib/style.css';
import {parseYaml, parseYamlDoc} from 'mmt-core/markupConvertor';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

type StepStatus = 'pending' | 'passed' | 'failed';

type SuiteTreeItemData =
  | {type: 'root'; label: string}
  | {type: 'group'; label: string}
  | {type: 'file'; path: string};

type SuiteEntry = {id: string; path: string};
type SuiteGroup = {label: string; entries: SuiteEntry[]};

let suiteEntrySuffix = 0;
const nextSuiteEntryId = () => `suite-entry-${suiteEntrySuffix++}`;

const buildSuiteGroupsFromContent = (content: string): SuiteGroup[] => {
  const parsed = parseYaml(content);
  const tests: any[] = Array.isArray(parsed?.tests) ? parsed.tests : [];
  const groups: SuiteGroup[] = [];
  let currentEntries: SuiteEntry[] = [];

  const pushGroup = () => {
    if (currentEntries.length) {
      groups.push({label: `Group ${groups.length + 1}`, entries: currentEntries});
      currentEntries = [];
    }
  };

  for (const raw of tests) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed === 'then') {
      pushGroup();
      continue;
    }
    currentEntries.push({id: nextSuiteEntryId(), path: trimmed});
  }
  pushGroup();
  return groups;
};

const flattenSuiteGroups = (groups: SuiteGroup[]): string[] => {
  const flattened: string[] = [];
  groups.forEach((group, idx) => {
    group.entries.forEach(entry => flattened.push(entry.path));
    if (idx < groups.length - 1) {
      flattened.push('then');
    }
  });
  return flattened;
};

const normalizeSuiteGroups = (groups: SuiteGroup[]): SuiteGroup[] => {
  const filtered = groups.filter(group => group.entries.length > 0);
  return filtered.map((group, idx) => ({...group, label: `Group ${idx + 1}`}));
};

const updateSuiteContentWithGroups = (content: string, groups: SuiteGroup[]): string | null => {
  try {
    const doc = parseYamlDoc(content);
    doc.set('tests', flattenSuiteGroups(groups));
    return doc.toString();
  } catch {
    return null;
  }
};

const buildSuiteTree = (groups: SuiteGroup[]) => {
  const items: Record<string, TreeItem<SuiteTreeItemData>> = {};
  const allPaths: string[] = [];
  const groupIds: string[] = [];

  groups.forEach((group, idx) => {
    const groupId = `group-${idx + 1}`;
    const childIds: string[] = [];
    group.entries.forEach(entry => {
      childIds.push(entry.id);
      allPaths.push(entry.path);
      items[entry.id] = {
        index: entry.id,
        isFolder: false,
        children: [],
        data: {type: 'file', path: entry.path},
      };
    });
    items[groupId] = {
      index: groupId,
      isFolder: true,
      children: childIds,
      data: {type: 'group', label: group.label},
    };
    groupIds.push(groupId);
  });

  items['suite-root'] = {
    index: 'suite-root',
    isFolder: true,
    children: groupIds,
    data: {type: 'root', label: 'Suite'},
  };

  return {items, allPaths, groupIds};
};

const SuitePanel: React.FC<SuitePanelProps> = ({content, setContent}) => {
  const [groups, setGroups] = useState<SuiteGroup[]>(() => buildSuiteGroupsFromContent(content));
  const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);

  useEffect(() => {
    setGroups(buildSuiteGroupsFromContent(content));
  }, [content]);

  const persistGroups = useCallback(
    (nextGroups: SuiteGroup[]) => {
      const normalized = normalizeSuiteGroups(nextGroups);
      setGroups(normalized);
      const updated = updateSuiteContentWithGroups(content, normalized);
      if (updated) {
        setContent(updated);
      }
    },
    [content, setContent]
  );

  const treeData = useMemo(() => buildSuiteTree(groups), [groups]);
  const {items, allPaths, groupIds} = treeData;
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
    const map = new Map<string, {group: number; idx: number}>();
    groups.forEach((group, groupIdx) => {
      group.entries.forEach((entry, idx) => map.set(entry.id, {group: groupIdx, idx}));
    });
    return map;
  }, [groups]);

  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStepStatuses(prev => {
      const next: Record<string, StepStatus> = {};
      const pathSet = new Set(allPaths);
      Object.keys(prev).forEach(path => {
        if (pathSet.has(path)) {
          next[path] = prev[path];
        }
      });
      allPaths.forEach(path => {
        if (!next[path]) {
          next[path] = 'pending';
        }
      });
      return next;
    });
  }, [allPaths]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command === 'suiteStatusUpdate') {
        const statuses = message.statuses;
        if (statuses && typeof statuses === 'object') {
          setStepStatuses(prev => ({...prev, ...statuses}));
        }
        return;
      }
      if (message.command === 'validateFilesExistResult') {
        setMissingFiles(new Set(message.missing || []));
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (allPaths.length > 0) {
      window.vscode?.postMessage({
        command: 'validateFilesExist',
        files: allPaths,
      });
    } else {
      setMissingFiles(new Set());
    }
  }, [allPaths]);

  useEffect(() => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      groupIds.forEach(id => next.add(id));
      return Array.from(next);
    });
  }, [groupIds]);

  const statusIconFor = useCallback((status: StepStatus) => {
    if (status === 'passed') {
      return {
        icon: 'codicon-pass',
        color: 'var(--vscode-testing-iconPassed, #23d18b)',
        title: 'Passed',
      };
    }
    if (status === 'failed') {
      return {
        icon: 'codicon-error',
        color: 'var(--vscode-editorError-foreground, #f85149)',
        title: 'Failed',
      };
    }
    return {
      icon: 'codicon-circle-large',
      color: 'var(--vscode-editor-foreground, #c5c5c5)',
      title: 'Pending',
    };
  }, []);

  const getStatusForPath = useCallback(
    (path: string): StepStatus => {
      return stepStatuses[path] ?? 'pending';
    },
    [stepStatuses]
  );

  const getGroupStatus = useCallback(
    (itemId: string): StepStatus => {
      const childIds = items[itemId]?.children || [];
      if (!childIds.length) {
        return 'pending';
      }
      const statuses = childIds.map(childId => {
        const child = items[childId];
        if (child?.data?.type === 'file') {
          if (missingFiles.has(child.data.path)) {
            return 'failed';
          }
          return getStatusForPath(child.data.path);
        }
        return 'pending';
      });
      if (statuses.includes('failed')) {
        return 'failed';
      }
      if (statuses.every(status => status === 'passed')) {
        return 'passed';
      }
      return 'pending';
    },
    [getStatusForPath, items, missingFiles]
  );

  const handleExpand = useCallback(
    (item: TreeItem<SuiteTreeItemData>) => {
      setExpandedItems(prev => (prev.includes(String(item.index)) ? prev : [...prev, String(item.index)]));
    },
    []
  );

  const handleCollapse = useCallback(
    (item: TreeItem<SuiteTreeItemData>) => {
      setExpandedItems(prev => prev.filter(id => id !== String(item.index)));
    },
    []
  );

  const handleRunSuite = () => {
    const next: Record<string, StepStatus> = {};
    allPaths.forEach(path => {
      next[path] = 'pending';
    });
    setStepStatuses(next);
    window.vscode?.postMessage({command: 'runCurrentDocument'});
  };

  const handleDrop = useCallback(
    (draggedItems: any[], target: DraggingPosition) => {
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

      const parentItemId =
        'parentItem' in target && typeof target.parentItem === 'string'
          ? target.parentItem
          : undefined;
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
        nextGroups[targetGroupIdx] = {label: `Group ${targetGroupIdx + 1}`, entries: []};
      }

      const removedBefore = entriesToMove.reduce((count, entry) => {
        const pos = entryPositions.get(entry.id);
        if (pos?.group === targetGroupIdx && typeof pos.idx === 'number' && pos.idx < insertBase) {
          return count + 1;
        }
        return count;
      }, 0);

      const insertIdx = Math.max(
        0,
        Math.min(insertBase - removedBefore, nextGroups[targetGroupIdx].entries.length)
      );

      nextGroups[targetGroupIdx].entries.splice(insertIdx, 0, ...entriesToMove);
      persistGroups(nextGroups);
    },
    [persistGroups, entryById, entryPositions, groupIdToIndex, groups]
  );

  const renderItem = ({item, context, arrow, children}: any) => {
    const data = item.data as SuiteTreeItemData;
    if (data.type === 'group' || data.type === 'root') {
      const isRoot = data.type === 'root';
      const statusIcon = isRoot
        ? {icon: 'codicon-files', color: 'var(--vscode-editor-foreground, #c5c5c5)'}
        : statusIconFor(getGroupStatus(item.index));

      return (
        <div {...context.itemContainerWithChildrenProps}>
          <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps} style={{alignItems: 'flex-start'}}>
            {arrow}
            <div style={{display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8}}>
              <span
                className={`codicon ${statusIcon.icon}`}
                aria-hidden
                style={{color: statusIcon.color}}
              />
              <span style={{fontFamily: 'var(--vscode-editor-font-family)'}}>{data.label}</span>
            </div>
          </div>
          {children}
        </div>
      );
    }

    const isMissing = missingFiles.has(data.path);
    const status = getStatusForPath(data.path);
    const statusIcon = isMissing
      ? {
          icon: 'codicon-warning',
          color: 'var(--vscode-editorWarning-foreground, #f8b449)',
          title: 'File not found',
        }
      : statusIconFor(status);

    const stopTreeEvent = (event: React.SyntheticEvent) => event.stopPropagation();
    const NoTreeInterference: React.FC<{children: React.ReactNode}> = ({children}) => (
      <div
        onMouseDownCapture={stopTreeEvent}
        onFocusCapture={stopTreeEvent}
        onKeyDown={stopTreeEvent}
        onKeyUp={stopTreeEvent}
        onInputCapture={stopTreeEvent}
        style={{flex: 1, minWidth: 0}}
      >
        {children}
      </div>
    );

    const onChange = (value: string) => {
      const nextGroups = groups.map(group => ({
        ...group,
        entries: group.entries.map(entry =>
          entry.id === item.index ? {...entry, path: value} : entry
        ),
      }));
      persistGroups(nextGroups);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
    };

    return (
      <div {...context.itemContainerWithChildrenProps}>
        <div className="tree-view-box" {...context.itemContainerWithoutChildrenProps}>
          {arrow}
          <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0}}>
            <span
              className={`codicon ${statusIcon.icon}`}
              aria-hidden
              title={statusIcon.title}
              style={{color: statusIcon.color}}
            />
            <NoTreeInterference>
              <input
                className="suite-entry-input"
                value={data.path}
                onChange={e => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                style={{opacity: isMissing ? 0.7 : 1}}
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
              marginTop: 4,
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

  const noItems = groups.every(group => group.entries.length === 0);

  return (
    <div className="test-flow-tree" style={{paddingTop: 4}}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center'}}>
        <div style={{fontWeight: 700}}>Suite</div>
        <button
          type="button"
          disabled={allPaths.length === 0}
          onClick={handleRunSuite}
          title={allPaths.length === 0 ? 'No suite files to run' : 'Run suite'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 12px',
          }}
        >
          <span className="codicon codicon-run" style={{fontSize: 18}} aria-hidden></span>
          Run suite
        </button>
      </div>
      {noItems ? (
        <div style={{opacity: 0.8}}>No suite items found under `tests:`</div>
      ) : (
        <ControlledTreeEnvironment
          items={items}
          getItemTitle={item => (item.data?.type === 'file' ? item.data.path : item.data?.label ?? '')}
          canDragAndDrop={true}
          canDropOnFolder={true}
          canReorderItems={true}
          canSearch={false}
          canSearchByStartingTyping={false}
          viewState={{'suite-tree': {expandedItems}}}
          onExpandItem={handleExpand}
          onCollapseItem={handleCollapse}
          onDrop={handleDrop}
          onSelectItems={() => {}}
          renderItemArrow={({item, context}) =>
            item.isFolder ? (
              <span
                {...context.arrowProps}
                style={{display: 'inline-flex', paddingTop: 8, lineHeight: 0, alignSelf: 'flex-start'}}
              >
                {context.isExpanded ? (
                  <span className="codicon codicon-chevron-down" style={{fontSize: 16}} />
                ) : (
                  <span className="codicon codicon-chevron-right" style={{fontSize: 16}} />
                )}
              </span>
            ) : (
              <span style={{display: 'inline-block', width: 24, height: 24}} />
            )
          }
          renderItem={renderItem}
          renderTreeContainer={({children, containerProps}) => <div {...containerProps}>{children}</div>}
          renderItemsContainer={({children, containerProps}) => (
            <ul
              {...containerProps}
              style={{...(containerProps.style || {}), margin: 0, listStyle: 'none'}}
            >
              {children}
            </ul>
          )}
          renderDragBetweenLine={({lineProps}) => (
            <div
              {...lineProps}
              style={{background: 'var(--vscode-focusBorder, #264f78)', height: '1px'}}
            />
          )}
        >
          <Tree treeId="suite-tree" rootItem="suite-root" treeLabel="Suite structure" />
        </ControlledTreeEnvironment>
      )}
    </div>
  );
};

export default SuitePanel;
