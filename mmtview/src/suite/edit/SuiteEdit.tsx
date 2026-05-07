import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parseYaml, parseYamlDoc } from 'mmt-core/markupConvertor';
import { suiteToYaml, yamlToSuite } from 'mmt-core/suiteParsePack';
import { SuiteEntry, SuiteGroup } from '../types';
import SuiteEditTree from './SuiteEditTree';
import { statusIconFor } from '../../shared/Common';
import FileOverview from '../../shared/FileOverview';
import FilePickerInput from '../../components/FilePickerInput';
import KSVEditor from '../../components/KSVEditor';
import { FileContext } from '../../fileContext';

type SuiteEditTab = 'overview' | 'tests' | 'servers' | 'environment' | 'exports';

interface SuiteEnvironmentConfig {
  preset?: string;
  file?: string;
  variables?: Record<string, unknown>;
}

interface SuiteOverviewConfig {
  title?: string;
  description?: string;
  tags?: string[];
}

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

const canonicalizeSuiteYaml = (content: string): string => {
  try {
    return suiteToYaml(yamlToSuite(content));
  } catch {
    return content;
  }
};

const updateSuiteContentWithGroups = (content: string, groups: SuiteGroup[]): string | null => {
  try {
    const doc = parseYamlDoc(content);
    doc.set('tests', flattenSuiteGroups(groups));
    return canonicalizeSuiteYaml(doc.toString());
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
    return canonicalizeSuiteYaml(doc.toString());
  } catch {
    return null;
  }
};

const buildEnvironmentFromContent = (content: string): SuiteEnvironmentConfig | null => {
  const parsed = parseYaml(content);
  if (!parsed?.environment || typeof parsed.environment !== 'object') {
    return null;
  }
  const env = parsed.environment;
  const result: SuiteEnvironmentConfig = {};
  if (typeof env.preset === 'string') {
    result.preset = env.preset;
  }
  if (typeof env.file === 'string') {
    result.file = env.file;
  }
  if (env.variables && typeof env.variables === 'object') {
    result.variables = env.variables;
  }
  return Object.keys(result).length > 0 ? result : null;
};

const buildOverviewFromContent = (content: string): SuiteOverviewConfig => {
  const parsed = parseYaml(content);
  return {
    title: typeof parsed?.title === 'string' ? parsed.title : undefined,
    description: typeof parsed?.description === 'string' ? parsed.description : undefined,
    tags: Array.isArray(parsed?.tags)
      ? parsed.tags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean)
      : undefined,
  };
};

const updateSuiteContentWithOverview = (content: string, overview: SuiteOverviewConfig): string | null => {
  try {
    const doc = parseYamlDoc(content);
    if (overview.title) {
      doc.set('title', overview.title);
    } else {
      doc.delete('title');
    }
    if (overview.description) {
      doc.set('description', overview.description);
    } else {
      doc.delete('description');
    }
    if (overview.tags && overview.tags.length > 0) {
      doc.set('tags', overview.tags);
    } else {
      doc.delete('tags');
    }
    return canonicalizeSuiteYaml(doc.toString());
  } catch {
    return null;
  }
};

const updateSuiteContentWithEnvironment = (content: string, env: SuiteEnvironmentConfig | null): string | null => {
  try {
    const doc = parseYamlDoc(content);
    if (!env || (env.preset === undefined && env.file === undefined && (!env.variables || Object.keys(env.variables).length === 0))) {
      doc.delete('environment');
    } else {
      const envObj: any = {};
      if (env.preset) {
        envObj.preset = env.preset;
      }
      if (env.file) {
        envObj.file = env.file;
      }
      if (env.variables && Object.keys(env.variables).length > 0) {
        envObj.variables = env.variables;
      }
      doc.set('environment', envObj);
    }
    return canonicalizeSuiteYaml(doc.toString());
  } catch {
    return null;
  }
};

const buildExportsFromContent = (content: string): string[] => {
  const parsed = parseYaml(content);
  if (!Array.isArray(parsed?.export)) {
    return [];
  }
  return parsed.export
    .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
};

const updateSuiteContentWithExports = (content: string, exports: string[]): string | null => {
  try {
    const doc = parseYamlDoc(content);
    if (exports.length === 0) {
      doc.delete('export');
    } else {
      doc.set('export', exports);
    }
    return canonicalizeSuiteYaml(doc.toString());
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
  const fileContext = useContext(FileContext);
  const [activeTab, setActiveTab] = useState<SuiteEditTab>('overview');
  const [overview, setOverview] = useState<SuiteOverviewConfig>(() => buildOverviewFromContent(content));
  const [groups, setGroups] = useState<SuiteGroup[]>(() => buildSuiteGroupsFromContent(content));
  const [servers, setServers] = useState<string[]>(() => buildServersFromContent(content));
  const [environment, setEnvironment] = useState<SuiteEnvironmentConfig | null>(() => buildEnvironmentFromContent(content));
  const [exports, setExports] = useState<string[]>(() => buildExportsFromContent(content));
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    setOverview(buildOverviewFromContent(content));
    setGroups(buildSuiteGroupsFromContent(content));
    setServers(buildServersFromContent(content));
    setEnvironment(buildEnvironmentFromContent(content));
    setExports(buildExportsFromContent(content));
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

  const persistOverview = useCallback(
    (patch: SuiteOverviewConfig) => {
      const nextOverview = { ...overview, ...patch };
      setOverview(nextOverview);
      const updated = updateSuiteContentWithOverview(content, nextOverview);
      if (updated) {
        setContent(updated);
      }
    },
    [content, overview, setContent]
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

  const persistEnvironment = useCallback(
    (nextEnv: SuiteEnvironmentConfig | null) => {
      setEnvironment(nextEnv);
      const updated = updateSuiteContentWithEnvironment(content, nextEnv);
      if (updated) {
        setContent(updated);
      }
    },
    [content, setContent]
  );

  const handleEnvPresetChange = useCallback((value: string) => {
    const next = { ...environment, preset: value || undefined };
    if (!next.preset && !next.file && (!next.variables || Object.keys(next.variables).length === 0)) {
      persistEnvironment(null);
    } else {
      persistEnvironment(next);
    }
  }, [environment, persistEnvironment]);

  const handleEnvFileChange = useCallback((value: string) => {
    const next = { ...environment, file: value || undefined };
    if (!next.preset && !next.file && (!next.variables || Object.keys(next.variables).length === 0)) {
      persistEnvironment(null);
    } else {
      persistEnvironment(next);
    }
  }, [environment, persistEnvironment]);

  const handleEnvVariablesChange = useCallback((value: Record<string, string>) => {
    const vars = Object.keys(value).length > 0 ? value : undefined;
    const next = { ...environment, variables: vars };
    if (!next.preset && !next.file && (!next.variables || Object.keys(next.variables).length === 0)) {
      persistEnvironment(null);
    } else {
      persistEnvironment(next);
    }
  }, [environment, persistEnvironment]);

  const persistExports = useCallback(
    (nextExports: string[]) => {
      setExports(nextExports);
      const updated = updateSuiteContentWithExports(content, nextExports);
      if (updated) {
        setContent(updated);
      }
    },
    [content, setContent]
  );

  const handleAddExport = useCallback(() => {
    persistExports([...exports, 'reports/report.html']);
  }, [exports, persistExports]);

  const handleRemoveExport = useCallback((index: number) => {
    const next = exports.filter((_, i) => i !== index);
    persistExports(next);
  }, [exports, persistExports]);

  const handleChangeExport = useCallback((index: number, value: string) => {
    const next = exports.map((s, i) => i === index ? value : s);
    persistExports(next);
  }, [exports, persistExports]);

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

  const testsTabContent = (
    <div style={{ paddingTop: 8 }}>
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
          </div>
        )}
      </div>
      {noItems ? (
        <div style={{ opacity: 0.8 }}>No suite items found under `tests:`</div>
      ) : (
        tree
      )}
    </div>
  );

  const overviewTabContent = (
    <FileOverview
      title={overview.title}
      description={overview.description}
      tags={overview.tags}
      onChange={persistOverview}
      tagSuggestions={['suite', 'regression', 'smoke', 'user', 'admin']}
    />
  );

  const serversTabContent = (
    <div style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className="button-icon"
          onClick={handleAddServer}
          title="Add server file"
        >
          <span className="codicon codicon-add" aria-hidden />
          Add server
        </button>
      </div>
      {servers.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No servers configured. Add a mock server file to run before the suite.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {servers.map((s, i) => (
            <FilePickerInput
              key={i}
              value={s}
              onChange={(v) => handleChangeServer(i, v)}
              onRemovePressed={() => handleRemoveServer(i)}
              basePath={fileContext.mmtFilePath}
              filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
              showFilePicker
              removable
            />
          ))}
        </div>
      )}
    </div>
  );

  const environmentTabContent = (
    <div style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>Preset</div>
      <div style={{ marginBottom: 12, paddingLeft: 4 }}>
        <input
          type="text"
          className="vscode-input"
          value={environment?.preset || ''}
          onChange={(e) => handleEnvPresetChange(e.target.value)}
          placeholder="preset name (from multimeter.mmt or env file)"
          style={{ width: '100%' }}
        />
      </div>
      <div className="label" style={{ marginBottom: 6 }}>Environment File</div>
      <div style={{ marginBottom: 12, paddingLeft: 4 }}>
        <FilePickerInput
          value={environment?.file || ''}
          onChange={handleEnvFileChange}
          basePath={fileContext.mmtFilePath}
          filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
          showFilePicker
          placeholder="path to env.mmt file"
        />
      </div>
      <div className="label" style={{ marginBottom: 6 }}>Variables</div>
      <div style={{ paddingLeft: 4 }}>
        <KSVEditor
          label=""
          value={environment?.variables as Record<string, string> || {}}
          onChange={handleEnvVariablesChange}
          keyPlaceholder="variable name"
          valuePlaceholder="value"
        />
      </div>
    </div>
  );

  const exportsTabContent = (
    <div style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className="button-icon"
          onClick={handleAddExport}
          title="Add export path"
        >
          <span className="codicon codicon-add" aria-hidden />
          Add export
        </button>
      </div>
      {exports.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No exports configured. Add paths to generate reports after suite completion.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exports.map((ex, i) => (
            <FilePickerInput
              key={i}
              value={ex}
              onChange={(v) => handleChangeExport(i, v)}
              onRemovePressed={() => handleRemoveExport(i)}
              basePath={fileContext.mmtFilePath}
              placeholder="e.g., reports/results.html or +/report.xml"
              removable
            />
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, opacity: 0.7, fontSize: '0.9em' }}>
        <div>Supported formats: <code>.html</code>, <code>.xml</code> (JUnit), <code>.md</code>, <code>.mmt</code></div>
        <div style={{ marginTop: 4 }}>Paths are relative to the suite file. Use <code>+/</code> prefix for project root.</div>
      </div>
    </div>
  );

  return (
    <div style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="tab-bar" style={{ flexShrink: 0 }}>
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          title="Overview"
          type="button"
        >
          <span className="codicon codicon-note tab-button-icon" aria-hidden />
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
          title="Tests"
          type="button"
        >
          <span className="codicon codicon-beaker tab-button-icon" aria-hidden />
          Tests
        </button>
        <button
          className={`tab-button ${activeTab === 'servers' ? 'active' : ''}`}
          onClick={() => setActiveTab('servers')}
          title="Servers"
          type="button"
        >
          <span className="codicon codicon-server-environment tab-button-icon" aria-hidden />
          Servers
        </button>
        <button
          className={`tab-button ${activeTab === 'environment' ? 'active' : ''}`}
          onClick={() => setActiveTab('environment')}
          title="Environment"
          type="button"
        >
          <span className="codicon codicon-symbol-namespace tab-button-icon" aria-hidden />
          Environment
        </button>
        <button
          className={`tab-button ${activeTab === 'exports' ? 'active' : ''}`}
          onClick={() => setActiveTab('exports')}
          title="Exports"
          type="button"
        >
          <span className="codicon codicon-export tab-button-icon" aria-hidden />
          Exports
        </button>
      </div>
      <div className="test-flow-tree" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'overview' && overviewTabContent}
        {activeTab === 'tests' && testsTabContent}
        {activeTab === 'servers' && serversTabContent}
        {activeTab === 'environment' && environmentTabContent}
        {activeTab === 'exports' && exportsTabContent}
      </div>
    </div>
  );
};

export default SuiteEdit;
