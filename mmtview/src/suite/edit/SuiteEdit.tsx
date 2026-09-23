import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { parseYaml } from 'mmt-core/markupConvertor';
import { suiteToYaml, yamlToSuite } from 'mmt-core/suiteParsePack';
import { parseSuiteYamlFilter } from 'mmt-core/suiteTagFilter';
import { SuiteData, SuiteEnvironment, SuiteYamlFilter } from 'mmt-core/SuiteData';
import { SuiteEntry, SuiteGroup } from '../types';
import SuiteEditTree from './SuiteEditTree';
import { statusIconFor } from '../../shared/Common';
import FileOverview from '../../shared/FileOverview';
import FilePickerInput from '../../components/FilePickerInput';
import KSVEditor from '../../components/KSVEditor';
import SearchableTagInput from '../../components/SearchableTagInput';
import { duplicateSuiteServerPaths, isDuplicateSuiteServerPath } from '../../text/validator';
import { FileContext } from '../../fileContext';
import TabBar from '../../components/TabBar';
import PrimaryButton from '../../components/PrimaryButton';
import PopupMenu, { usePopupMenu } from '../../components/PopupMenu';

type SuiteEditTab = 'overview' | 'items' | 'filter' | 'servers' | 'environment' | 'exports';

const SUITE_EDIT_TABS = [
  { id: 'overview' as const, label: 'Overview', icon: 'note' },
  { id: 'items' as const, label: 'Items', icon: 'beaker' },
  { id: 'filter' as const, label: 'Filter', icon: 'filter' },
  { id: 'servers' as const, label: 'Servers', icon: 'server-environment' },
  { id: 'environment' as const, label: 'Environment', icon: 'symbol-namespace' },
  { id: 'exports' as const, label: 'Exports', icon: 'export' },
];

interface SuiteFilterConfig {
  only: string[];
  skip: string[];
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
  const items: any[] = Array.isArray(parsed?.items)
    ? parsed.items
    : (Array.isArray(parsed?.tests) ? parsed.tests : []);
  const groups: SuiteGroup[] = [];
  let currentEntries: SuiteEntry[] = [];

  const pushGroup = () => {
    if (currentEntries.length) {
      groups.push({ label: `Group ${groups.length + 1}`, entries: currentEntries });
      currentEntries = [];
    }
  };

  for (const raw of items) {
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

const buildImportsFromContent = (content: string): Record<string, string> => {
  const parsed = parseYaml(content);
  if (!parsed?.import || typeof parsed.import !== 'object' || Array.isArray(parsed.import)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed.import)
      .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
      .map(([key, value]) => [key, value as string])
  );
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

const rewriteSuiteYaml = (content: string, patch: (suite: SuiteData) => void): string | null => {
  try {
    const suite = yamlToSuite(content);
    patch(suite);
    return suiteToYaml(suite, content);
  } catch {
    return null;
  }
};

const updateSuiteContentWithGroups = (content: string, groups: SuiteGroup[]): string | null => {
  return rewriteSuiteYaml(content, (suite) => {
    suite.items = flattenSuiteGroups(groups);
  });
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
  return rewriteSuiteYaml(content, (suite) => {
    suite.servers = servers.length > 0 ? servers : undefined;
  });
};

const buildFilterFromContent = (content: string): SuiteFilterConfig => {
  const parsed = parseYaml(content);
  const filter = parseSuiteYamlFilter(parsed?.filter);
  return {
    only: filter?.only ?? [],
    skip: filter?.skip ?? [],
  };
};

const updateSuiteContentWithFilter = (content: string, filter: SuiteFilterConfig): string | null => {
  return rewriteSuiteYaml(content, (suite) => {
    const next: SuiteYamlFilter = {};
    if (filter.only.length > 0) {
      next.only = filter.only;
    }
    if (filter.skip.length > 0) {
      next.skip = filter.skip;
    }
    suite.filter = (next.only || next.skip) ? next : undefined;
  });
};

const buildEnvironmentFromContent = (content: string): SuiteEnvironment | null => {
  const parsed = parseYaml(content);
  if (!parsed?.environment || typeof parsed.environment !== 'object') {
    return null;
  }
  const env = parsed.environment;
  const result: SuiteEnvironment = {};
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
  return rewriteSuiteYaml(content, (suite) => {
    suite.title = overview.title;
    suite.description = overview.description;
    suite.tags = overview.tags && overview.tags.length > 0 ? overview.tags : undefined;
  });
};

const updateSuiteContentWithImports = (content: string, imports: Record<string, string>): string | null => {
  return rewriteSuiteYaml(content, (suite) => {
    suite.import = Object.keys(imports).length > 0 ? imports : undefined;
  });
};

const updateSuiteContentWithEnvironment = (content: string, env: SuiteEnvironment | null): string | null => {
  return rewriteSuiteYaml(content, (suite) => {
    if (!env || (env.preset === undefined && env.file === undefined &&
        (!env.variables || Object.keys(env.variables).length === 0))) {
      suite.environment = undefined;
      return;
    }
    const envObj: SuiteData['environment'] = {};
    if (env.preset) {
      envObj.preset = env.preset;
    }
    if (env.file) {
      envObj.file = env.file;
    }
    if (env.variables && Object.keys(env.variables).length > 0) {
      envObj.variables = env.variables;
    }
    suite.environment = envObj;
  });
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
  return rewriteSuiteYaml(content, (suite) => {
    suite.export = exports.length > 0 ? exports : undefined;
  });
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
  const [imports, setImports] = useState<Record<string, string>>(() => buildImportsFromContent(content));
  const [groups, setGroups] = useState<SuiteGroup[]>(() => buildSuiteGroupsFromContent(content));
  const [filter, setFilter] = useState<SuiteFilterConfig>(() => buildFilterFromContent(content));
  const [servers, setServers] = useState<string[]>(() => buildServersFromContent(content));
  const [environment, setEnvironment] = useState<SuiteEnvironment | null>(() => buildEnvironmentFromContent(content));
  const [exports, setExports] = useState<string[]>(() => buildExportsFromContent(content));
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());
  const [itemServerFiles, setItemServerFiles] = useState<string[]>([]);

  const {
    open: addMenuOpen,
    position: addMenuPos,
    triggerRef: addButtonRef,
    menuRef: addMenuRef,
    toggle: toggleAddMenu,
    close: closeAddMenu,
  } = usePopupMenu({ width: 220, offsetY: 6 });

  useEffect(() => {
    setOverview(buildOverviewFromContent(content));
    setImports(buildImportsFromContent(content));
    setGroups(buildSuiteGroupsFromContent(content));
    setFilter(buildFilterFromContent(content));
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

  const persistImports = useCallback((nextImports: Record<string, string>) => {
    setImports(nextImports);
    const updated = updateSuiteContentWithImports(content, nextImports);
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const handleAddGroup = useCallback(() => {
    const placeholder = createPlaceholderEntry();
    const nextGroups = [...groups, { label: `Group ${groups.length + 1}`, entries: [placeholder] }];
    persistGroups(nextGroups);
    closeAddMenu();
  }, [closeAddMenu, groups, persistGroups]);

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
    closeAddMenu();
  }, [closeAddMenu, groups, persistGroups]);

  const persistFilter = useCallback(
    (nextFilter: SuiteFilterConfig) => {
      setFilter(nextFilter);
      const updated = updateSuiteContentWithFilter(content, nextFilter);
      if (updated) {
        setContent(updated);
      }
    },
    [content, setContent]
  );

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
    (nextEnv: SuiteEnvironment | null) => {
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
  const duplicateServerKeys = useMemo(
    () => duplicateSuiteServerPaths(servers, allPaths, itemServerFiles),
    [servers, allPaths, itemServerFiles],
  );
  useEffect(() => {
    const files = Array.from(new Set([...allPaths, ...servers]));
    if (files.length > 0) {
      window.vscode?.postMessage({ command: 'validateFilesExist', files });
    } else {
      setMissingFiles(new Set());
      setItemServerFiles([]);
    }
  }, [allPaths, servers]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.command === 'validateFilesExistResult') {
        setMissingFiles(new Set(message.missing || []));
        const listed = Array.isArray(message.servers)
          ? message.servers.filter((p: unknown): p is string => typeof p === 'string')
          : [];
        setItemServerFiles(listed.filter((path: string) => allPaths.includes(path)));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [allPaths]);

  const noItems = groups.every(group => group.entries.length === 0);
  const tree = (
    <SuiteEditTree
      groups={groups}
      missingFiles={missingFiles}
      duplicateServerKeys={duplicateServerKeys}
      statusIconFor={statusIconFor}
      groupsModel={groups}
      persistGroups={persistGroups}
      canEdit={true}
    />
  );

  const testsTabContent = (
    <div className="pt-8">
      <div className="actions-end">
        <PrimaryButton
          ref={addButtonRef}
          icon="add"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => {
            event.stopPropagation();
            toggleAddMenu();
          }}
          title="Add suite item"
        >
          Add item
        </PrimaryButton>
        {addMenuOpen && addMenuPos && (
          <PopupMenu
            position={addMenuPos}
            menuRef={addMenuRef}
            className="popup-menu is-wide"
            itemClassName="menu-item"
            onClose={closeAddMenu}
            items={[
              {
                label: "Add group (then)",
                icon: "codicon-list-tree",
                iconClass: "icon-sm",
                title: "Insert a group separator (then)",
                onClick: handleAddGroup,
              },
              {
                label: "Add test file",
                icon: "codicon-symbol-file",
                iconClass: "icon-sm",
                title: "Add a test file entry",
                onClick: handleAddTestFile,
              },
            ]}
          />
        )}
      </div>
      {noItems ? (
        <div className="muted">No suite items found under `items:`</div>
      ) : (
        tree
      )}
    </div>
  );

  const overviewTabContent = (
    <>
      <FileOverview
        title={overview.title}
        description={overview.description}
        tags={overview.tags}
        onChange={persistOverview}
        tagSuggestions={['suite', 'regression', 'smoke', 'user', 'admin']}
      />
      <div className="edit-tab-pad">
        <KSVEditor
          label="Import"
          value={imports}
          onChange={persistImports}
          keyPlaceholder="alias"
          valuePlaceholder="path"
          filePicker={true}
          filePickerFilters={[
            { name: 'Data files', extensions: ['json', 'yaml', 'yml', 'csv'] },
          ]}
        />
      </div>
    </>
  );

  const filterTabContent = (
    <div className="edit-section">
      <div className="label is-field">Only tags</div>
      <div className="field-inset">
        <SearchableTagInput
          tags={filter.only}
          onChange={(tags) => persistFilter({ ...filter, only: tags })}
          placeholder="only"
        />
      </div>
      <div className="label is-field">Skip tags</div>
      <div className="field-inset">
        <SearchableTagInput
          tags={filter.skip}
          onChange={(tags) => persistFilter({ ...filter, skip: tags })}
          placeholder="skip"
        />
      </div>
      <div className="hint-text is-block">
        <div>Only: run just the tests and suites tagged with one of these. Empty runs everything.</div>
        <div className="field-block is-tight">Skip: never run tests and suites carrying one of these tags.</div>
        <div className="field-block is-tight">Filters match <code>tags:</code> on test and suite files. A tagged suite runs its whole subtree.</div>
      </div>
    </div>
  );

  const serversTabContent = (
    <div className="edit-section">
      <div className="actions-end">
        <PrimaryButton icon="add" onClick={handleAddServer} title="Add server file">
          Add server
        </PrimaryButton>
      </div>
      {servers.length === 0 ? (
        <div className="muted">No servers configured. Add a mock server file to run before the suite.</div>
      ) : (
        <div className="field-stack">
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
              invalid={isDuplicateSuiteServerPath(s, duplicateServerKeys)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const environmentTabContent = (
    <div className="edit-section">
      <div className="label is-field">Preset</div>
      <div className="field-inset">
        <input
          type="text"
          className="vscode-input mmt-fill"
          value={environment?.preset || ''}
          onChange={(e) => handleEnvPresetChange(e.target.value)}
          placeholder="preset name (from multimeter.mmt or env file)"
        />
      </div>
      <div className="label is-field">Environment File</div>
      <div className="field-inset">
        <FilePickerInput
          value={environment?.file || ''}
          onChange={handleEnvFileChange}
          basePath={fileContext.mmtFilePath}
          filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
          showFilePicker
          placeholder="path to env.mmt file"
        />
      </div>
      <div className="label is-field">Variables</div>
      <div className="field-inset">
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
    <div className="edit-section">
      <div className="actions-end">
        <PrimaryButton icon="add" onClick={handleAddExport} title="Add export path">
          Add export
        </PrimaryButton>
      </div>
      {exports.length === 0 ? (
        <div className="muted">No exports configured. Add paths to generate reports after suite completion.</div>
      ) : (
        <div className="field-stack">
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
      <div className="hint-text is-block">
        <div>Supported formats: <code>.html</code>, <code>.xml</code> (JUnit), <code>.md</code>, <code>.mmt</code></div>
        <div className="field-block is-tight">Paths are relative to the suite file. Use <code>+/</code> prefix for project root.</div>
      </div>
    </div>
  );

  return (
    <div className="panel-page is-clip">
      <TabBar
        tabs={SUITE_EDIT_TABS}
        value={activeTab}
        onChange={setActiveTab}
        className="no-shrink"
      />
      <div className="test-flow-tree panel-scroll">
        {activeTab === 'overview' && overviewTabContent}
        {activeTab === 'items' && testsTabContent}
        {activeTab === 'filter' && filterTabContent}
        {activeTab === 'servers' && serversTabContent}
        {activeTab === 'environment' && environmentTabContent}
        {activeTab === 'exports' && exportsTabContent}
      </div>
    </div>
  );
};

export default SuiteEdit;
