import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseYaml, parseYamlDoc } from 'mmt-core/markupConvertor';
import { SuiteEntry, SuiteGroup } from '../types';
import SuiteEditTree from './SuiteEditTree';
import { statusIconFor } from '../../shared/Common';

interface SuiteEditProps {
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

const buildServersFromContent = (content: string): string[] => {
  const parsed = parseYaml(content);
  if (!Array.isArray(parsed?.servers)) {
    return [];
  }
  return parsed.servers
    .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
};

const updateSuiteContentWithServers = (content: string, servers: string[]): string | null => {
  try {
    const doc = parseYamlDoc(content);
    if (servers.length === 0) {
      doc.delete('servers');
    } else {
      doc.set('servers', servers);
    }
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

const SuiteEdit: React.FC<SuiteEditProps> = ({ content, setContent }) => {
  const [groups, setGroups] = useState<SuiteGroup[]>(() => buildSuiteGroupsFromContent(content));
  const [servers, setServers] = useState<string[]>(() => buildServersFromContent(content));
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    setGroups(buildSuiteGroupsFromContent(content));
    setServers(buildServersFromContent(content));
  }, [content]);

  const persistGroups = useCallback(
    (nextGroups: SuiteGroup[]) => {
      const normalized = normalizeSuiteGroups(nextGroups);
      setGroups(normalized);
      const updated = updateSuiteContentWithGroups(content, normalized);
      if (updated) {
        setContent(updated);
      } else {
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
      if (addMenuRef.current?.contains(event.target as Node)) {
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
      nextGroups = groups.map((group, idx) => idx === targetIdx ? { ...group, entries: [...group.entries, placeholder] } : group);
    }
    persistGroups(nextGroups);
    setAddMenuOpen(false);
  }, [groups, persistGroups]);

  const persistServers = useCallback(
    (nextServers: string[]) => {
      setServers(nextServers);
      const updated = updateSuiteContentWithServers(content, nextServers);
      if (updated) {
        setContent(updated);
      }
    },
    [content, setContent]
  );

  const handleAddServer = useCallback(() => {
    persistServers([...servers, 'server path']);
    setAddMenuOpen(false);
  }, [servers, persistServers]);

  const handleRemoveServer = useCallback((index: number) => {
    const next = servers.filter((_, i) => i !== index);
    persistServers(next);
  }, [servers, persistServers]);

  const handleChangeServer = useCallback((index: number, value: string) => {
    const next = servers.map((s, i) => i === index ? value : s);
    persistServers(next);
  }, [servers, persistServers]);

  const allPaths = useMemo(() => collectSuitePaths(groups), [groups]);
  useEffect(() => {
    if (allPaths.length > 0) {
      window.vscode?.postMessage({ command: 'validateFilesExist', files: allPaths });
    } else {
      setMissingFiles(new Set());
    }
  }, [allPaths]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command === 'validateFilesExistResult') {
        setMissingFiles(new Set(message.missing || []));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const noItems = groups.every(group => group.entries.length === 0);
  const tree = (
    <SuiteEditTree
      groups={groups}
      missingFiles={missingFiles}
      statusIconFor={statusIconFor}
      groupsModel={groups}
      persistGroups={persistGroups}
      canEdit={true}
    />
  );
  return (
    <div className="panel-box" style={{ overflow: 'auto', flex: 1 }}>
      <div className="test-flow-tree" style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 8,
            alignItems: 'center',
            position: 'relative',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              ref={addButtonRef as any}
              className="button-icon"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => {
                event.stopPropagation();
                toggleAddMenu();
              }}
              title="Add suite item"
            >
              <span className="codicon codicon-add" aria-hidden />
              Add item
            </button>
          </div>
          {addMenuOpen && addMenuPos && (
            <div
              ref={addMenuRef}
              style={{
                position: 'fixed',
                left: addMenuPos.left,
                top: addMenuPos.top,
                zIndex: 1000,
                background: 'var(--vscode-editorWidget-background,#232323)',
                border: '1px solid var(--vscode-editorWidget-border,#333)',
                borderRadius: 4,
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                minWidth: 220,
                padding: 4,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="action-button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onClick={() => handleAddGroup()}
                title="Insert a group separator (then)"
              >
                <span className="codicon codicon-list-tree" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                <span>Add group (then)</span>
              </button>
              <button
                className="action-button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onClick={() => handleAddTestFile()}
                title="Add a test file entry"
              >
                <span className="codicon codicon-symbol-file" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                <span>Add test file</span>
              </button>
              <button
                className="action-button"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onClick={() => handleAddServer()}
                title="Add a mock server file to run before the suite"
              >
                <span className="codicon codicon-server-environment" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                <span>Add server file</span>
              </button>
            </div>
          )}
        </div>
        {servers.length > 0 && (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Servers</div>
            <div style={{ marginBottom: 12, paddingLeft: 4 }}>
              {servers.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <span className="codicon codicon-server-environment" style={{ fontSize: 14, opacity: 0.85 }} aria-hidden />
                  <input
                    type="text"
                    value={s}
                    onChange={(e) => handleChangeServer(i, e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--vscode-input-background, #1e1e1e)',
                      color: 'var(--vscode-input-foreground, #ccc)',
                      border: '1px solid var(--vscode-input-border, #3c3c3c)',
                      borderRadius: 3,
                      padding: '2px 6px',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    className="button-icon"
                    onClick={() => handleRemoveServer(i)}
                    title="Remove server"
                    style={{ padding: '2px 4px' }}
                  >
                    <span className="codicon codicon-trash" style={{ fontSize: 13 }} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {noItems ? (
          <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div>
        ) : (
          <>
            <div className="label" style={{ marginBottom: 6 }}>Tests</div>
            {tree}
          </>
        )}
      </div>
    </div >
  );
};

export default SuiteEdit;
