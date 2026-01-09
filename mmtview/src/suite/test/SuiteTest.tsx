import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { StepStatus, SuiteEntry, SuiteGroup } from '../types';
import SuiteTestTree from './SuiteTestTree';

interface SuiteTestProps {
  content: string;
}

let suiteEntrySuffix = 0;
const nextSuiteEntryId = () => `suite-entry-test-${suiteEntrySuffix++}`;

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

const collectSuitePaths = (groups: SuiteGroup[]): string[] => {
  const allPaths: string[] = [];
  groups.forEach((group) => group.entries.forEach((entry) => allPaths.push(entry.path)));
  return allPaths;
};

const statusIconFor = (status: StepStatus | 'running') => {
  if (status === 'running') {
    return { icon: 'codicon-play-circle', color: '#BA8E23', title: 'Running' };
  }
  if (status === 'passed') {
    return { icon: 'codicon-pass', color: '#23d18b', title: 'Passed' };
  }
  if (status === 'failed') {
    return { icon: 'codicon-error', color: '#f85149', title: 'Failed' };
  }
  if (status === 'pending') {
    return { icon: 'codicon-compass', color: '#3794ff', title: 'Pending' };
  }
  return { icon: 'codicon-circle-large', color: '#c5c5c5', title: 'Default' };
};

const SuiteTest: React.FC<SuiteTestProps> = ({ content }) => {
  const groups = useMemo(() => buildSuiteGroupsFromContent(content), [content]);
  const allPaths = useMemo(() => collectSuitePaths(groups), [groups]);
  const canRun = allPaths.length > 0;
  const noItems = groups.every(group => group.entries.length === 0);

  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus | 'running'>>({});
  const [lastRunIdByEntryId, setLastRunIdByEntryId] = useState<Record<string, string>>({});
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStepStatuses({});
  }, [content]);

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
              setStepStatuses(prev => ({ ...prev, [entry.id]: nextStatus }));
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
      window.vscode?.postMessage({ command: 'validateFilesExist', files: allPaths });
    } else {
      setMissingFiles(new Set());
    }
  }, [allPaths]);

  const onRunSuite = useCallback(() => {
    const next: Record<string, StepStatus | 'running'> = {};
    groups.forEach((group) => group.entries.forEach((entry) => (next[entry.id] = 'pending')));
    setStepStatuses(next);
    window.vscode?.postMessage({ command: 'runCurrentDocument' });
  }, [groups]);

  const tree = (
    <SuiteTestTree
      groups={groups}
      missingFiles={missingFiles}
      stepStatuses={stepStatuses}
      lastRunIdByEntryId={lastRunIdByEntryId}
      statusIconFor={statusIconFor}
    />
  );

  return (
    <div className="panel-box">
      <div className="test-flow-tree" style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            alignItems: 'center',
            position: 'relative',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>Suite Test</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="button-icon"
              disabled={!canRun}
              onClick={onRunSuite}
              title={!canRun ? 'No suite files to run' : 'Run suite'}
            >
              <span className="codicon codicon-run" aria-hidden />
              Run suite
            </button>
          </div>
        </div>
        {noItems ? <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div> : tree}
      </div>
    </div>
  );
};

export default SuiteTest;
