import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthConfig } from 'mmt-core/APIData';
import { JudgeData, JudgeEngineId } from 'mmt-core/JudgeData';
import { yamlToJudge } from 'mmt-core/judgeParsePack';
import { resolveEnvTokenValues } from 'mmt-core/variableReplacer';
import DescriptionEditor from '../components/DescriptionEditor';
import SearchableTagInput from '../components/SearchableTagInput';
import TabBar from '../components/TabBar';
import PanelRunHeader, { HeaderAction } from '../components/PanelRunHeader';
import PanelEditHeader from '../components/PanelEditHeader';
import { HideWhenYamlError } from '../api/YamlErrorWarning';
import { loadEnvVariables } from '../workspaceStorage';
import { useAccentChrome } from '../shared/useAccentChrome';
import { accentChromeCssVars } from '../shared/themeAccent';
import { safeList } from 'mmt-core/safer';
import { patchJudgeYaml } from './judgeYaml';

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

function authTypeValue(auth: AuthConfig | undefined): string {
  if (!auth || auth === 'none') {
    return 'none';
  }
  return auth.type;
}

const JudgePanel: React.FC<JudgePanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<'view' | 'edit'>(
      () => (localStorage.getItem(LAST_JUDGE_PAGE_KEY) as 'view' | 'edit') || 'view');
  const [tab, setTab] = useState<'overview' | 'engine'>(() => {
    const saved = localStorage.getItem(LAST_JUDGE_TAB_KEY);
    return saved === 'engine' || saved === 'overview' ? saved : 'overview';
  });
  const [envParams, setEnvParams] = useState<Record<string, any>>({});

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

  const chrome = useAccentChrome('#e3b341');
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

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'Engine', value: String(judge.engine || '') },
    { label: 'Model', value: String(judge.model || '') },
  ];
  if (urlRaw) {
    summaryRows.push({
      label: 'URL',
      value: urlResolved && urlResolved !== urlRaw
          ? `${urlRaw} → ${urlResolved}`
          : urlRaw,
    });
  }
  if (auth && auth !== 'none') {
    summaryRows.push({ label: 'Auth', value: auth.type });
    if (auth.type === 'bearer' && auth.token) {
      summaryRows.push({ label: 'Token', value: String(auth.token) });
    }
  } else if (auth === 'none') {
    summaryRows.push({ label: 'Auth', value: 'none' });
  }
  if (temperature != null) {
    summaryRows.push({ label: 'Temperature', value: String(temperature) });
  }
  if (timeout != null) {
    summaryRows.push({ label: 'Timeout', value: String(timeout) });
  }

  return (
    <div className="panel" style={chromeVars as React.CSSProperties}>
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'view' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <PanelRunHeader
                title={judge.title || 'Judge'}
                icon="law"
                iconTitle="AI Judge"
                iconStyle={{ color: chrome.text }}
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
              <HideWhenYamlError>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
                  {judge.description ? (
                    <div style={{ opacity: 0.85, whiteSpace: 'pre-wrap' }}>{judge.description}</div>
                  ) : null}
                  <div
                    style={{
                      border: '1px solid var(--vscode-editorWidget-border, #444)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>
                      Model
                    </div>
                    {summaryRows.map((row) => (
                      <div key={row.label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                        <span style={{ minWidth: 100, opacity: 0.7 }}>{row.label}</span>
                        <span
                          style={{
                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                            wordBreak: 'break-all',
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {judge.defaults?.checks || judge.defaults?.criteria ? (
                    <div
                      style={{
                        border: '1px solid var(--vscode-editorWidget-border, #444)',
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                        Defaults
                      </div>
                      {judge.defaults.checks ? (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                          {JSON.stringify(judge.defaults.checks, null, 2)}
                        </pre>
                      ) : null}
                      {Array.isArray(judge.defaults.criteria) && judge.defaults.criteria.length > 0 ? (
                        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                          {judge.defaults.criteria.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </HideWhenYamlError>
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
                          value={String(judge.engine || 'ollama')}
                          onChange={(e) => update({ engine: e.target.value as JudgeEngineId })}
                        >
                          {ENGINE_OPTIONS.map((id) => (
                            <option key={id} value={id}>{id}</option>
                          ))}
                        </select>
                      </div>

                      <div className="label">Model</div>
                      <div style={{ padding: 5 }}>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={judge.model || ''}
                          onChange={(e) => update({ model: e.target.value })}
                          placeholder="e.g. qwen2.5:3b"
                        />
                      </div>

                      <div className="label">URL</div>
                      <div style={{ padding: 5 }}>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={urlRaw}
                          onChange={(e) => update({ url: e.target.value })}
                          placeholder="e:ollama_url"
                        />
                      </div>

                      <div className="label">Auth</div>
                      <div style={{ padding: 5, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                              update({ auth: { type: 'api-key', header: 'Authorization', value: '' } });
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
                              placeholder="e:openai_api_key"
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
