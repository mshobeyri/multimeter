import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthConfig } from 'mmt-core/APIData';
import { JudgeData, JudgeEngineId } from 'mmt-core/JudgeData';
import { yamlToJudge } from 'mmt-core/judgeParsePack';
import { resolveEnvTokenValues } from 'mmt-core/variableReplacer';
import DescriptionEditor from '../components/DescriptionEditor';
import SearchableTagInput from '../components/SearchableTagInput';
import TabBar from '../components/TabBar';
import PanelRunHeader, { HeaderAction } from '../components/PanelRunHeader';
import PanelEditHeader from '../components/PanelEditHeader';
import PrimaryButton from '../components/PrimaryButton';
import SettingsTable, { SettingsTableColumn, SettingsTableRow } from '../components/SettingsTable';
import { HideWhenYamlError } from '../api/YamlErrorWarning';
import { loadEnvVariables } from '../workspaceStorage';
import { useAccentChrome } from '../shared/useAccentChrome';
import { accentChromeCssVars } from '../shared/themeAccent';
import { safeList } from 'mmt-core/safer';
import { NetworkNodeApi } from '../components/network/NetworkNodeApi';
import { patchJudgeYaml } from './judgeYaml';
import { JudgeProbeResult, probeJudgeConnection } from './judgeProbe';
import { JudgeModelInfo, modelMatchesConfigured } from './judgeProbeHelpers';
import {
  defaultUrlForEngine,
  isDefaultJudgeUrl,
} from './judgeEngineDefaults';
import { JudgeModelCombo, JudgeUrlField } from './judgeEngineFields';
import { JUDGE_BUILTIN_CHECKS } from 'mmt-core/judgeChecks';

interface JudgePanelProps {
  content: string;
  setContent: (value: string) => void;
}

const LAST_JUDGE_PAGE_KEY = 'mmtview:judge:lastPage';
const LAST_JUDGE_TAB_KEY = 'mmtview:judge:lastTab';

const JUDGE_EDIT_TABS = [
  { id: 'overview' as const, label: 'Overview', icon: 'search' },
  { id: 'engine' as const, label: 'Engine', icon: 'hubot' },
];

const ENGINE_OPTIONS: JudgeEngineId[] = [
  'ollama', 'openai', 'anthropic', 'google', 'azure-openai',
];

const AUTH_TYPE_OPTIONS = ['none', 'bearer', 'basic', 'api-key'] as const;

const ENGINE_AUTH_HINT: Record<string, string> = {
  ollama: 'Usually none for local Ollama',
  openai: 'bearer + e:openai_api_key',
  anthropic: 'api-key header x-api-key (or bearer token)',
  google: 'api-key / bearer → x-goog-api-key',
  'azure-openai': 'api-key header (or bearer)',
};

function authTypeValue(auth: AuthConfig | undefined): string {
  if (!auth || auth === 'none') {
    return 'none';
  }
  return auth.type;
}

function formatAuthSummary(auth: AuthConfig | undefined): string | undefined {
  if (!auth || auth === 'none') {
    return undefined;
  }
  if (auth.type === 'bearer') {
    return 'bearer';
  }
  if (auth.type === 'basic') {
    return 'basic';
  }
  if (auth.type === 'api-key') {
    const where = auth.header || auth.query;
    return where ? `api-key (${where})` : 'api-key';
  }
  return String((auth as {type?: string}).type || 'auth');
}

const CONFIG_COLUMNS: SettingsTableColumn[] = [
  { key: 'field', label: 'Field', width: '28%', variant: 'key' },
  { key: 'value', label: 'Value', width: '72%', variant: 'code' },
];

const MODEL_COLUMNS: SettingsTableColumn[] = [
  { key: 'model', label: 'Model', width: '42%', variant: 'code' },
  { key: 'detail', label: 'Details', width: '28%' },
  { key: 'size', label: 'Size', width: '15%' },
  { key: 'status', label: 'Status', width: '15%' },
];

const BUILTIN_CHECK_COLUMNS: SettingsTableColumn[] = [
  { key: 'check', label: 'Check', width: '28%', variant: 'code' },
  { key: 'meaning', label: 'Meaning', width: '42%' },
  { key: 'context', label: 'Context', width: '30%', variant: 'code' },
];

function buildConfigRows(args: {
  engine: string;
  urlRaw: string;
  urlResolved: string;
  model: string;
  authSummary?: string;
  temperature?: unknown;
  timeout?: unknown;
  statusLabel: string;
  statusDetail?: string;
  defaultsChecks?: unknown;
  defaultsCriteria?: string[];
}): SettingsTableRow[] {
  const rows: SettingsTableRow[] = [
    { key: 'engine', cells: { field: 'Engine', value: args.engine || '—' } },
    {
      key: 'url',
      cells: {
        field: 'URL',
        value: (
          <span title={args.urlRaw !== args.urlResolved ? args.urlRaw : undefined}>
            {args.urlResolved || args.urlRaw || '—'}
          </span>
        ),
      },
    },
    { key: 'model', cells: { field: 'Model', value: args.model || '—' } },
    {
      key: 'status',
      cells: {
        field: 'Status',
        value: args.statusDetail
            ? `${args.statusLabel} · ${args.statusDetail}`
            : args.statusLabel,
      },
    },
  ];
  if (args.authSummary) {
    rows.push({ key: 'auth', cells: { field: 'Auth', value: args.authSummary } });
  }
  if (args.temperature != null && args.temperature !== '') {
    rows.push({
      key: 'temperature',
      cells: { field: 'Temperature', value: String(args.temperature) },
    });
  }
  if (args.timeout != null && args.timeout !== '') {
    rows.push({
      key: 'timeout',
      cells: { field: 'Timeout', value: String(args.timeout) },
    });
  }
  if (args.defaultsChecks != null) {
    rows.push({
      key: 'defaults-checks',
      cells: {
        field: 'Default checks',
        value: (
          <pre className="judge-table-pre">
            {JSON.stringify(args.defaultsChecks, null, 2)}
          </pre>
        ),
      },
    });
  }
  if (args.defaultsCriteria && args.defaultsCriteria.length > 0) {
    rows.push({
      key: 'defaults-criteria',
      cells: {
        field: 'Default criteria',
        value: args.defaultsCriteria.join('\n'),
      },
    });
  }
  return rows;
}

function buildModelRows(
    models: JudgeModelInfo[],
    configuredModel: string|undefined,
    ): SettingsTableRow[] {
  return models.map((model) => {
    const selected = modelMatchesConfigured(model.name, configuredModel);
    return {
      key: model.name,
      cells: {
        model: model.name,
        detail: model.detail || '—',
        size: model.sizeLabel || '—',
        status: selected ? 'Selected' : '',
      },
    };
  });
}

function modelsEmptyLabel(probe: JudgeProbeResult): string {
  if (probe.state === 'loading') {
    return 'Checking connection…';
  }
  if (probe.state === 'error') {
    return probe.message || 'Unable to list models';
  }
  if (probe.state === 'idle') {
    return 'Refresh to list models from the engine.';
  }
  return 'No models reported by this engine.';
}

const JudgePanel: React.FC<JudgePanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<'view' | 'edit'>(
      () => (localStorage.getItem(LAST_JUDGE_PAGE_KEY) as 'view' | 'edit') || 'view');
  const [tab, setTab] = useState<'overview' | 'engine'>(() => {
    const saved = localStorage.getItem(LAST_JUDGE_TAB_KEY);
    return saved === 'engine' || saved === 'overview' ? saved : 'overview';
  });
  const [envParams, setEnvParams] = useState<Record<string, any>>({});
  const [probe, setProbe] = useState<JudgeProbeResult>({ state: 'idle', models: [] });
  const probeRequestRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(LAST_JUDGE_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_JUDGE_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const cleanup = loadEnvVariables((envVars) => {
      const params: Record<string, any> = {};
      for (const v of envVars || []) {
        if (v && typeof v === 'object' && typeof v.name === 'string') {
          params[v.name] = v.value;
        }
      }
      setEnvParams(params);
    });
    return cleanup;
  }, []);

  const judge = useMemo(() => {
    try {
      return yamlToJudge(content);
    } catch {
      return null;
    }
  }, [content]);

  const update = useCallback((patch: Partial<JudgeData>) => {
    setContent(patchJudgeYaml(content, (prev) => {
      const next: JudgeData = { ...prev, ...patch };
      for (const [key, value] of Object.entries(patch)) {
        if (value === '' || value === undefined || value === null) {
          delete (next as any)[key];
        }
      }
      return next;
    }));
  }, [content, setContent]);

  const refreshStatus = useCallback(() => {
    if (!judge) {
      return;
    }
    if (probeRequestRef.current) {
      NetworkNodeApi.cancel(probeRequestRef.current);
    }
    probeRequestRef.current = probeJudgeConnection({
      engine: String(judge.engine || ''),
      url: String(judge.url || ''),
      model: String(judge.model || ''),
      auth: judge.auth,
      envParams,
      onResult: setProbe,
    });
  }, [judge, envParams]);

  // Auto-probe on view, and when editing the Engine tab.
  useEffect(() => {
    if (!judge?.url) {
      return;
    }
    if (page === 'view' || (page === 'edit' && tab === 'engine')) {
      refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, judge?.engine, judge?.url, judge?.model, judge?.auth, envParams]);

  const chrome = useAccentChrome('#e3b341');
  const greenChrome = useAccentChrome('green');
  const redChrome = useAccentChrome('red');
  const chromeVars = accentChromeCssVars(chrome);

  if (!judge || judge.type !== 'judge') {
    return (
      <div style={{ padding: 16, color: 'var(--vscode-descriptionForeground)' }}>
        Invalid or incomplete judge definition. Ensure the file has{' '}
        <code>type: judge</code>, <code>engine</code>, <code>model</code>, and <code>url</code>.
      </div>
    );
  }

  const urlRaw = typeof judge.url === 'string' ? judge.url : '';
  const urlResolved = urlRaw
      ? String(resolveEnvTokenValues(urlRaw, envParams) || urlRaw)
      : '';
  const temperature = judge.options?.temperature;
  const timeout = judge.options?.timeout;
  const auth = judge.auth;
  const engineId = String(judge.engine || 'ollama');

  const statusChrome = probe.state === 'ok'
      ? greenChrome
      : probe.state === 'error'
          ? redChrome
          : chrome;
  const statusLabel = probe.state === 'loading'
      ? 'Checking…'
      : probe.state === 'ok'
          ? (probe.configuredModelPresent === false ? 'Model missing' : 'Connected')
          : probe.state === 'error'
              ? 'Unreachable'
              : 'Unknown';

  const statusDetail = [
    probe.durationMs != null && probe.state !== 'loading' ? `${probe.durationMs}ms` : null,
    probe.state === 'ok' && probe.configuredModelPresent === false ? 'model not on engine' : null,
    probe.state === 'error' ? probe.message : null,
  ].filter(Boolean).join(' · ') || undefined;

  const configRows = buildConfigRows({
    engine: engineId,
    urlRaw,
    urlResolved,
    model: String(judge.model || ''),
    authSummary: formatAuthSummary(auth),
    temperature,
    timeout,
    statusLabel,
    statusDetail,
    defaultsChecks: judge.defaults?.checks,
    defaultsCriteria: Array.isArray(judge.defaults?.criteria)
        ? judge.defaults!.criteria
        : undefined,
  });
  const modelRows = buildModelRows(probe.models, judge.model);

  return (
    <div className="panel" style={chromeVars as React.CSSProperties}>
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'view' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>
                <PanelRunHeader
                  title={judge.title || 'Judge'}
                  icon="law"
                  iconTitle="AI Judge"
                  iconStyle={{ color: statusChrome.text, transition: 'color 0.2s' }}
                  actions={
                    <HideWhenYamlError>
                      <HeaderAction
                        icon="edit"
                        label="Edit Judge"
                        onClick={() => setPage('edit')}
                        title="Edit judge configuration"
                      />
                    </HideWhenYamlError>
                  }
                />
                <div className="run-action-bar">
                  <PrimaryButton
                    icon="refresh"
                    iconSpin={probe.state === 'loading'}
                    disabled={probe.state === 'loading' || !urlRaw}
                    onClick={refreshStatus}
                    title="Check engine connection"
                  >
                    Refresh status
                  </PrimaryButton>
                </div>

                <HideWhenYamlError>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 12px 12px' }}>
                    {judge.description ? (
                      <div style={{ opacity: 0.85, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                        {judge.description}
                      </div>
                    ) : null}

                    <div className="label" style={{ marginBottom: 8 }}>Configuration</div>
                    <SettingsTable
                      columns={CONFIG_COLUMNS}
                      rows={configRows}
                      emptyLabel="No judge configuration."
                    />

                    <div className="label" style={{ marginTop: 16, marginBottom: 8 }}>
                      Available models
                      {probe.models.length ? ` (${probe.models.length})` : ''}
                    </div>
                    <SettingsTable
                      columns={MODEL_COLUMNS}
                      rows={modelRows}
                      emptyLabel={modelsEmptyLabel(probe)}
                      isRowActive={(row) =>
                        modelMatchesConfigured(String(row.key || ''), judge.model)
                      }
                    />

                    <div className="label" style={{ marginTop: 16, marginBottom: 8 }}>
                      Built-in checks
                    </div>
                    <SettingsTable
                      columns={BUILTIN_CHECK_COLUMNS}
                      rows={JUDGE_BUILTIN_CHECKS.map((check) => ({
                        key: check.id,
                        cells: {
                          check: check.id,
                          meaning: check.description,
                          context: check.contextHints.join(', '),
                        },
                      }))}
                    />
                  </div>
                </HideWhenYamlError>
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <PanelEditHeader
                title="Edit judge"
                onBack={() => setPage('view')}
                backTitle="Back to Judge"
              >
                <TabBar tabs={JUDGE_EDIT_TABS} value={tab} onChange={setTab} />
              </PanelEditHeader>

              <HideWhenYamlError>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
                  {tab === 'overview' && (
                    <>
                      <div className="label">Title</div>
                      <div style={{ padding: 5 }}>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={judge.title || ''}
                          onChange={(e) => update({ title: e.target.value })}
                          placeholder="title"
                        />
                      </div>

                      <div className="label">Tags</div>
                      <div style={{ padding: 5 }}>
                        <SearchableTagInput
                          tags={safeList(judge.tags)}
                          onChange={(tags) => update({ tags })}
                          suggestions={['quality', 'local', 'ollama', 'cloud']}
                        />
                      </div>

                      <div className="label">Description</div>
                      <div style={{ padding: 5 }}>
                        <DescriptionEditor
                          value={judge.description || ''}
                          onChange={(value) => update({ description: value })}
                        />
                      </div>
                    </>
                  )}

                  {tab === 'engine' && (
                    <>
                      <div className="label">Engine</div>
                      <div style={{ padding: 5 }}>
                        <select
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={engineId}
                          onChange={(e) => {
                            const nextEngine = e.target.value as JudgeEngineId;
                            const keepCustom = urlRaw.trim() !== ''
                                && !isDefaultJudgeUrl(engineId, urlRaw);
                            update({
                              engine: nextEngine,
                              ...(keepCustom
                                  ? {}
                                  : { url: defaultUrlForEngine(nextEngine) }),
                            });
                          }}
                        >
                          {ENGINE_OPTIONS.map((id) => (
                            <option key={id} value={id}>{id}</option>
                          ))}
                        </select>
                      </div>

                      <div className="label">URL</div>
                      <div style={{ padding: 5 }}>
                        <JudgeUrlField
                          value={urlRaw}
                          defaultUrl={defaultUrlForEngine(engineId)}
                          isDefault={isDefaultJudgeUrl(engineId, urlRaw)}
                          onChange={(url) => update({ url })}
                          onApplyDefault={() => update({ url: defaultUrlForEngine(engineId) })}
                          placeholder={defaultUrlForEngine(engineId)}
                        />
                      </div>

                      <div className="label">Model</div>
                      <div style={{ padding: 5 }}>
                        <JudgeModelCombo
                          value={judge.model || ''}
                          models={probe.models}
                          probeState={probe.state}
                          probeMessage={probe.message}
                          onChange={(model) => update({ model })}
                          onRefresh={refreshStatus}
                          placeholder={
                            engineId === 'azure-openai'
                                ? 'deployment name'
                                : 'e.g. qwen2.5:3b'
                          }
                        />
                      </div>

                      <div className="label" style={{ marginTop: 8 }}>
                        Available models
                        {probe.models.length ? ` (${probe.models.length})` : ''}
                      </div>
                      <div style={{ padding: '5px 0 8px' }}>
                        <SettingsTable
                          columns={MODEL_COLUMNS}
                          rows={modelRows}
                          emptyLabel={modelsEmptyLabel(probe)}
                          onRowClick={(row) => {
                            if (row.key != null) {
                              update({ model: String(row.key) });
                            }
                          }}
                          isRowActive={(row) =>
                            modelMatchesConfigured(String(row.key || ''), judge.model)
                          }
                        />
                      </div>

                      <div className="label">Auth</div>
                      <div style={{ padding: 5, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {ENGINE_AUTH_HINT[engineId] || 'Optional auth for cloud engines'}
                        </div>
                        <select
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={authTypeValue(auth)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'none') {
                              update({ auth: 'none' });
                            } else if (val === 'bearer') {
                              update({ auth: { type: 'bearer', token: '' } });
                            } else if (val === 'basic') {
                              update({ auth: { type: 'basic', username: '', password: '' } });
                            } else if (val === 'api-key') {
                              const header = engineId === 'anthropic'
                                  ? 'x-api-key'
                                  : engineId === 'google'
                                      ? 'x-goog-api-key'
                                      : engineId === 'azure-openai'
                                          ? 'api-key'
                                          : 'Authorization';
                              update({ auth: { type: 'api-key', header, value: '' } });
                            }
                          }}
                        >
                          {AUTH_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>

                        {auth && auth !== 'none' && auth.type === 'bearer' && (
                          <input
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            value={auth.token || ''}
                            onChange={(e) => update({
                              auth: { type: 'bearer', token: e.target.value },
                            })}
                            placeholder="e:openai_api_key"
                          />
                        )}

                        {auth && auth !== 'none' && auth.type === 'basic' && (
                          <>
                            <input
                              style={{ width: '100%', boxSizing: 'border-box' }}
                              value={auth.username || ''}
                              onChange={(e) => update({
                                auth: {
                                  type: 'basic',
                                  username: e.target.value,
                                  password: auth.password || '',
                                },
                              })}
                              placeholder="username"
                            />
                            <input
                              style={{ width: '100%', boxSizing: 'border-box' }}
                              value={auth.password || ''}
                              onChange={(e) => update({
                                auth: {
                                  type: 'basic',
                                  username: auth.username || '',
                                  password: e.target.value,
                                },
                              })}
                              placeholder="password"
                            />
                          </>
                        )}

                        {auth && auth !== 'none' && auth.type === 'api-key' && (
                          <>
                            <input
                              style={{ width: '100%', boxSizing: 'border-box' }}
                              value={auth.header || auth.query || ''}
                              onChange={(e) => {
                                const current = auth as {
                                  type: 'api-key'; header?: string; query?: string; value: string;
                                };
                                if (current.query != null && current.header == null) {
                                  update({
                                    auth: {
                                      type: 'api-key',
                                      query: e.target.value,
                                      value: current.value || '',
                                    },
                                  });
                                } else {
                                  update({
                                    auth: {
                                      type: 'api-key',
                                      header: e.target.value,
                                      value: current.value || '',
                                    },
                                  });
                                }
                              }}
                              placeholder="header or query name"
                            />
                            <input
                              style={{ width: '100%', boxSizing: 'border-box' }}
                              value={auth.value || ''}
                              onChange={(e) => {
                                const current = auth as {
                                  type: 'api-key'; header?: string; query?: string; value: string;
                                };
                                if (current.query != null && current.header == null) {
                                  update({
                                    auth: {
                                      type: 'api-key',
                                      query: current.query,
                                      value: e.target.value,
                                    },
                                  });
                                } else {
                                  update({
                                    auth: {
                                      type: 'api-key',
                                      header: current.header || 'Authorization',
                                      value: e.target.value,
                                    },
                                  });
                                }
                              }}
                              placeholder="e:api_key"
                            />
                          </>
                        )}
                      </div>

                      <div className="label">Temperature</div>
                      <div style={{ padding: 5 }}>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={temperature == null ? '' : String(temperature)}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const options = { ...(judge.options || {}) };
                            if (!raw) {
                              delete options.temperature;
                            } else {
                              const n = Number(raw);
                              options.temperature = Number.isFinite(n) ? n : raw as any;
                            }
                            update({ options: Object.keys(options).length ? options : undefined });
                          }}
                          placeholder="0"
                        />
                      </div>

                      <div className="label">Timeout</div>
                      <div style={{ padding: 5 }}>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={timeout == null ? '' : String(timeout)}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const options = { ...(judge.options || {}) };
                            if (!raw) {
                              delete options.timeout;
                            } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
                              options.timeout = Number(raw);
                            } else {
                              options.timeout = raw as any;
                            }
                            update({ options: Object.keys(options).length ? options : undefined });
                          }}
                          placeholder="30s"
                        />
                      </div>
                    </>
                  )}
                </div>
              </HideWhenYamlError>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JudgePanel;
