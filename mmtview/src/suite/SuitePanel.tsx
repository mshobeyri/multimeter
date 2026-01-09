import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DraggingPosition,
  DraggingPositionBetweenItems,
  DraggingPositionItem,
} from 'react-complex-tree';
import 'react-complex-tree/lib/style.css';
import { parseYaml, parseYamlDoc } from 'mmt-core/markupConvertor';
import { StepStatus, SuiteEntry, SuiteGroup } from './types';
import { FileContext } from '../fileContext';
import SuiteEdit from './SuiteEdit';
import SuiteTest from './SuiteTest';
import SuiteEditTree from './SuiteEditTree';
import SuiteTestTree from './SuiteTestTree';

interface SuitePanelProps {
  content: string;
  setContent: (value: string) => void;
}

let suiteEntrySuffix = 0;
const nextSuiteEntryId = () => `suite-entry-${suiteEntrySuffix++}`;
const createPlaceholderEntry = (): SuiteEntry => ({ id: nextSuiteEntryId(), path: 'test path' });

const buildSuiteGroupsFromContent = (content: string): SuiteGroup[] => {
  const parsed = parseYaml(content);
  const tests: any[] = Array.isArray(parsed?.tests) ? parsed.tests : [];
  const groups: SuiteGroup[] = [];
  let currentEntries: SuiteEntry[] = [];

  const pushGroup = () => {
    if (currentEntries.length) {
      groups.push({ label: `Group ${groups.length + 1}`, entries: currentEntries });
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
    currentEntries.push({ id: nextSuiteEntryId(), path: trimmed });
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
  return filtered.map((group, idx) => ({ ...group, label: `Group ${idx + 1}` }));
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

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
  const allPaths: string[] = [];
  groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
  return allPaths;
};

const SuitePanel: React.FC<SuitePanelProps> = ({ content, setContent }) => {
  const { mmtFilePath } = useContext(FileContext);
  const [groups, setGroups] = useState<SuiteGroup[]>(() => buildSuiteGroupsFromContent(content));
  const [expandedItems, setExpandedItems] = useState<string[]>(['suite-root']);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [tab, setTab] = useState<'edit' | 'test'>('edit');
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) {
        return;
      }
      const containerWidth = tabContainerRef.current.clientWidth;
      const fullTextWidth = 2 * 100;
      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

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

  const openAddMenuAtButton = useCallback(() => {
    const btn = addButtonRef.current;
    if (!btn) {
      setAddMenuPos(null);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    const margin = 8;
    const maxLeft = typeof window !== 'undefined' ? window.innerWidth - menuWidth - margin : margin;
    const preferred = rect.right - menuWidth;
    const left = Math.max(margin, Math.min(maxLeft, preferred));
    const top = rect.bottom + 6;
    setAddMenuPos({ left, top });
  }, []);

  useEffect(() => {
    if (!addMenuOpen) {
      setAddMenuPos(null);
      return;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    openAddMenuAtButton();
    const handlePointerDown = (event: MouseEvent) => {
      if (addButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      setAddMenuOpen(false);
    };
    const handleResize = () => setAddMenuOpen(false);
    document.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [addMenuOpen, openAddMenuAtButton]);

  const toggleAddMenu = useCallback(() => {
    setAddMenuOpen(prev => {
      const next = !prev;
      if (next) {
        openAddMenuAtButton();
      } else {
        setAddMenuPos(null);
      }
      return next;
    });
  }, [openAddMenuAtButton]);

  const handleAddGroup = useCallback(() => {
    const placeholder = createPlaceholderEntry();
    const nextGroups = [...groups, { label: `Group ${groups.length + 1}`, entries: [placeholder] }];
    persistGroups(nextGroups);
    setAddMenuOpen(false);
  }, [groups, persistGroups]);

  const handleAddTestFile = useCallback(() => {
    const placeholder = createPlaceholderEntry();
    let nextGroups: SuiteGroup[];
    if (!groups.length) {
      nextGroups = [{ label: 'Group 1', entries: [placeholder] }];
    } else {
      const targetIdx = groups.length - 1;
      nextGroups = groups.map((group, idx) =>
        idx === targetIdx ? { ...group, entries: [...group.entries, placeholder] } : group
      );
    }
    persistGroups(nextGroups);
    setAddMenuOpen(false);
  }, [groups, persistGroups]);

  const allPaths = useMemo(() => collectSuitePaths(groups), [groups]);
  const baseExpandedTreeState = useState<string[]>(['suite-root']);

  const groupIds = useMemo(() => {
    const ids: string[] = [];
    groups.forEach((_, idx) => ids.push(`group-${idx + 1}`));
    return ids;
  }, [groups]);

  // Drag/drop helpers remain in SuitePanel (edit tree consumes them).
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

  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus | 'running'>>({});
  const [lastRunIdByEntryId, setLastRunIdByEntryId] = useState<Record<string, string>>({});
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStepStatuses({});
  }, [groups]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command === 'runFileReport') {
        const runId = typeof (message as any).runId === 'string' ? (message as any).runId : null;
        const { groupIndex, groupItemIndex, success, status } = message as any;
        const nextStatus: StepStatus | 'running' = status || (success ? 'passed' : 'failed');

        if (runId && typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
          const group = groups[groupIndex];
          const entry = group?.entries?.[groupItemIndex];
          if (entry?.id) {
            setLastRunIdByEntryId(prev => ({ ...prev, [entry.id]: runId }));
          }
        }

        if (runId) {
          setStepStatuses(prev => ({ ...prev, [runId]: nextStatus }));
          return;
        }

        if (typeof groupIndex === 'number' && typeof groupItemIndex === 'number') {
          const group = groups[groupIndex];
          if (group) {
            const entry = group.entries[groupItemIndex];
            if (entry) {
              setStepStatuses(prev => ({
                ...prev,
                [entry.id]: nextStatus,
              }));
            }
          }
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
  }, [groups]);

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

  const statusIconFor = useCallback((status: StepStatus | 'running') => {
    if (status === 'running') {
      return {
        icon: 'codicon-play-circle',
        color: '#BA8E23',
        title: 'Running',
      };
    }
    if (status === 'passed') {
      return {
        icon: 'codicon-pass',
        color: '#23d18b',
        title: 'Passed',
      };
    }
    if (status === 'failed') {
      return {
        icon: 'codicon-error',
        color: '#f85149',
        title: 'Failed',
      };
    }
    if (status === 'pending') {
      return {
        icon: 'codicon-compass',
        color: '#3794ff',
        title: 'Pending',
      };
    }
    return {
      icon: 'codicon-circle-large',
      color: '#c5c5c5',
      title: 'Default',
    };
  }, []);

  const handleRunSuite = () => {
    const next: Record<string, StepStatus | 'running'> = {};
    // Initialize file rows as pending; specific runIds will fill as events arrive.
    // Only base suite entry ids are guaranteed here; initialize from Suite groups.
    groups.forEach((group) => group.entries.forEach((entry) => (next[entry.id] = 'pending')));
    setStepStatuses(next);
    window.vscode?.postMessage({ command: 'runCurrentDocument' });
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
        nextGroups[targetGroupIdx] = { label: `Group ${targetGroupIdx + 1}`, entries: [] };
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

  const noItems = groups.every(group => group.entries.length === 0);

  const canEdit = tab === 'edit';

  return (
    <div className="panel">
      <div className="panel-box">
        <div ref={tabContainerRef} className="tab-bar">
          <button
            onClick={() => setTab('edit')}
            className={`tab-button ${tab === 'edit' ? 'active' : ''}`}
            title={showIconsOnly ? 'Edit' : undefined}
          >
            <span className="codicon codicon-edit tab-button-icon" />
            {!showIconsOnly && 'Edit'}
          </button>
          <button
            onClick={() => setTab('test')}
            className={`tab-button ${tab === 'test' ? 'active' : ''}`}
            title={showIconsOnly ? 'Test' : undefined}
          >
            <span className="codicon codicon-play tab-button-icon" />
            {!showIconsOnly && 'Test'}
          </button>
        </div>

        {tab === 'edit' && (
          <SuiteEdit
            groups={groups}
            addButtonRef={addButtonRef}
            addMenuOpen={addMenuOpen}
            addMenuPos={addMenuPos}
            onAddMenuOpenChange={setAddMenuOpen}
            onOpenAddMenuAtButton={openAddMenuAtButton}
            onAddGroup={handleAddGroup}
            onAddTestFile={handleAddTestFile}
            tree={(
              <SuiteEditTree
                groups={groups}
                expandedItems={baseExpandedTreeState[0]}
                setExpandedItems={baseExpandedTreeState[1]}
                missingFiles={missingFiles}
                statusIconFor={statusIconFor}
                groupsModel={groups}
                persistGroups={persistGroups}
                canEdit={true}
                handleDrop={handleDrop}
              />
            )}
            noItems={noItems}
          />
        )}
        {tab === 'test' && (
          <SuiteTest
            canRun={allPaths.length > 0}
            onRunSuite={handleRunSuite}
            tree={(
              <SuiteTestTree
                groups={groups}
                missingFiles={missingFiles}
                stepStatuses={stepStatuses}
                lastRunIdByEntryId={lastRunIdByEntryId}
                statusIconFor={statusIconFor}
                canEdit={false}
                persistGroups={persistGroups}
              />
            )}
            noItems={noItems}
          />
        )}
      </div>
    </div>
  );
};

export default SuitePanel;
