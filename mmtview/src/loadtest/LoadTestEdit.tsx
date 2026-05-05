import React, { useCallback, useContext, useEffect, useState } from 'react';
import { parseYaml, parseYamlDoc } from 'mmt-core/markupConvertor';
import { loadtestToYaml, yamlToLoadTest } from 'mmt-core/loadtestParsePack';
import FilePickerInput from '../components/FilePickerInput';
import KSVEditor from '../components/KSVEditor';
import { FileContext } from '../fileContext';

type LoadTestEditTab = 'test' | 'load' | 'environment' | 'exports';

interface LoadTestEnvironmentConfig {
  preset?: string;
  file?: string;
  variables?: Record<string, unknown>;
}

interface LoadTestEditProps {
  content: string;
  setContent: (value: string) => void;
}

interface LoadConfig {
  threads?: number;
  repeat?: string | number;
  rampup?: string;
}

const canonicalizeLoadTestYaml = (content: string): string => {
  try {
    return loadtestToYaml(yamlToLoadTest(content));
  } catch {
    return content;
  }
};

const buildTestFromContent = (content: string): string => {
  const parsed = parseYaml(content);
  return typeof parsed?.test === 'string' ? parsed.test : '';
};

const buildLoadConfigFromContent = (content: string): LoadConfig => {
  const parsed = parseYaml(content);
  return {
    threads: typeof parsed?.threads === 'number' ? parsed.threads : undefined,
    repeat: typeof parsed?.repeat === 'number' || typeof parsed?.repeat === 'string' ? parsed.repeat : undefined,
    rampup: typeof parsed?.rampup === 'string' ? parsed.rampup : undefined,
  };
};

const buildEnvironmentFromContent = (content: string): LoadTestEnvironmentConfig | null => {
  const parsed = parseYaml(content);
  if (!parsed?.environment || typeof parsed.environment !== 'object') {
    return null;
  }
  const env = parsed.environment;
  const result: LoadTestEnvironmentConfig = {};
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

const buildExportsFromContent = (content: string): string[] => {
  const parsed = parseYaml(content);
  if (!Array.isArray(parsed?.export)) {
    return [];
  }
  return parsed.export
    .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
};

const updateLoadTestContent = (content: string, updater: (doc: any) => void): string | null => {
  try {
    const doc = parseYamlDoc(content);
    updater(doc);
    return canonicalizeLoadTestYaml(doc.toString());
  } catch {
    return null;
  }
};

const LoadTestEdit: React.FC<LoadTestEditProps> = ({ content, setContent }) => {
  const fileContext = useContext(FileContext);
  const [activeTab, setActiveTab] = useState<LoadTestEditTab>('test');
  const [test, setTest] = useState<string>(() => buildTestFromContent(content));
  const [load, setLoad] = useState<LoadConfig>(() => buildLoadConfigFromContent(content));
  const [environment, setEnvironment] = useState<LoadTestEnvironmentConfig | null>(() => buildEnvironmentFromContent(content));
  const [exports, setExports] = useState<string[]>(() => buildExportsFromContent(content));
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTest(buildTestFromContent(content));
    setLoad(buildLoadConfigFromContent(content));
    setEnvironment(buildEnvironmentFromContent(content));
    setExports(buildExportsFromContent(content));
  }, [content]);

  useEffect(() => {
    if (test) {
      window.vscode?.postMessage({ command: 'validateFilesExist', files: [test] });
    } else {
      setMissingFiles(new Set());
    }
  }, [test]);

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

  const persistTest = useCallback((nextTest: string) => {
    setTest(nextTest);
    const updated = updateLoadTestContent(content, (doc) => {
      doc.set('test', nextTest);
    });
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const persistLoad = useCallback((nextLoad: LoadConfig) => {
    setLoad(nextLoad);
    const updated = updateLoadTestContent(content, (doc) => {
      if (typeof nextLoad.threads === 'number') {
        doc.set('threads', nextLoad.threads);
      } else {
        doc.delete('threads');
      }
      if (nextLoad.repeat !== undefined && nextLoad.repeat !== '') {
        doc.set('repeat', nextLoad.repeat);
      } else {
        doc.delete('repeat');
      }
      if (nextLoad.rampup) {
        doc.set('rampup', nextLoad.rampup);
      } else {
        doc.delete('rampup');
      }
    });
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const persistEnvironment = useCallback((nextEnv: LoadTestEnvironmentConfig | null) => {
    setEnvironment(nextEnv);
    const updated = updateLoadTestContent(content, (doc) => {
      if (!nextEnv || (nextEnv.preset === undefined && nextEnv.file === undefined && (!nextEnv.variables || Object.keys(nextEnv.variables).length === 0))) {
        doc.delete('environment');
      } else {
        const envObj: any = {};
        if (nextEnv.preset) {
          envObj.preset = nextEnv.preset;
        }
        if (nextEnv.file) {
          envObj.file = nextEnv.file;
        }
        if (nextEnv.variables && Object.keys(nextEnv.variables).length > 0) {
          envObj.variables = nextEnv.variables;
        }
        doc.set('environment', envObj);
      }
    });
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const persistExports = useCallback((nextExports: string[]) => {
    setExports(nextExports);
    const updated = updateLoadTestContent(content, (doc) => {
      if (nextExports.length === 0) {
        doc.delete('export');
      } else {
        doc.set('export', nextExports);
      }
    });
    if (updated) {
      setContent(updated);
    }
  }, [content, setContent]);

  const handleThreadsChange = useCallback((value: string) => {
    const trimmed = value.trim();
    const threads = trimmed ? Number(trimmed) : undefined;
    persistLoad({ ...load, threads: Number.isFinite(threads) ? threads : undefined });
  }, [load, persistLoad]);

  const handleRepeatChange = useCallback((value: string) => {
    const trimmed = value.trim();
    const numeric = trimmed !== '' && /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
    persistLoad({ ...load, repeat: numeric || undefined });
  }, [load, persistLoad]);

  const handleRampupChange = useCallback((value: string) => {
    persistLoad({ ...load, rampup: value.trim() || undefined });
  }, [load, persistLoad]);

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

  const handleAddExport = useCallback(() => {
    persistExports([...exports, 'reports/load-report.html']);
  }, [exports, persistExports]);

  const handleRemoveExport = useCallback((index: number) => {
    persistExports(exports.filter((_, i) => i !== index));
  }, [exports, persistExports]);

  const handleChangeExport = useCallback((index: number, value: string) => {
    persistExports(exports.map((s, i) => i === index ? value : s));
  }, [exports, persistExports]);

  const testTabContent = (
    <div style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>Test File</div>
      <FilePickerInput
        value={test}
        onChange={persistTest}
        basePath={fileContext.mmtFilePath}
        filters={[{ name: 'MMT files', extensions: ['mmt'] }]}
        showFilePicker
        placeholder="path to one test.mmt file"
      />
      {missingFiles.has(test) && (
        <div style={{ marginTop: 8, color: 'var(--vscode-errorForeground)' }}>
          Referenced file was not found.
        </div>
      )}
      <div style={{ marginTop: 12, opacity: 0.7, fontSize: '0.9em' }}>
        Load tests run exactly one <code>type: test</code> file.
      </div>
    </div>
  );

  const loadTabContent = (
    <div style={{ paddingTop: 8, paddingLeft: 16, paddingRight: 16 }}>
      <div className="label" style={{ marginBottom: 6 }}>Threads</div>
      <input
        type="number"
        min={1}
        className="vscode-input"
        value={load.threads ?? ''}
        onChange={(e) => handleThreadsChange(e.target.value)}
        placeholder="100"
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div className="label" style={{ marginBottom: 6 }}>Repeat</div>
      <input
        type="text"
        className="vscode-input"
        value={load.repeat ?? ''}
        onChange={(e) => handleRepeatChange(e.target.value)}
        placeholder="1m or 1000"
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div className="label" style={{ marginBottom: 6 }}>Ramp-up</div>
      <input
        type="text"
        className="vscode-input"
        value={load.rampup ?? ''}
        onChange={(e) => handleRampupChange(e.target.value)}
        placeholder="10s"
        style={{ width: '100%', marginBottom: 12 }}
      />
      <div style={{ opacity: 0.7, fontSize: '0.9em' }}>
        Threads is target concurrency. Repeat can be a duration or iteration count. Ramp-up is the time to reach target concurrency.
      </div>
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
        <button className="button-icon" onClick={handleAddExport} title="Add export path">
          <span className="codicon codicon-add" aria-hidden />
          Add export
        </button>
      </div>
      {exports.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No exports configured. Add paths to generate reports after load test completion.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exports.map((ex, i) => (
            <FilePickerInput
              key={i}
              value={ex}
              onChange={(v) => handleChangeExport(i, v)}
              onRemovePressed={() => handleRemoveExport(i)}
              basePath={fileContext.mmtFilePath}
              placeholder="e.g., reports/load.html or +/reports/load.mmt"
              removable
            />
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, opacity: 0.7, fontSize: '0.9em' }}>
        <div>Supported formats: <code>.html</code>, <code>.xml</code> (JUnit), <code>.md</code>, <code>.mmt</code></div>
        <div style={{ marginTop: 4 }}>Paths are relative to the loadtest file. Use <code>+/</code> prefix for project root.</div>
      </div>
    </div>
  );

  return (
    <div style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="tab-bar" style={{ flexShrink: 0 }}>
        <button className={`tab-button ${activeTab === 'test' ? 'active' : ''}`} onClick={() => setActiveTab('test')} title="Test" type="button">
          <span className="codicon codicon-beaker tab-button-icon" aria-hidden />
          Test
        </button>
        <button className={`tab-button ${activeTab === 'load' ? 'active' : ''}`} onClick={() => setActiveTab('load')} title="Load" type="button">
          <span className="codicon codicon-dashboard tab-button-icon" aria-hidden />
          Load
        </button>
        <button className={`tab-button ${activeTab === 'environment' ? 'active' : ''}`} onClick={() => setActiveTab('environment')} title="Environment" type="button">
          <span className="codicon codicon-symbol-namespace tab-button-icon" aria-hidden />
          Environment
        </button>
        <button className={`tab-button ${activeTab === 'exports' ? 'active' : ''}`} onClick={() => setActiveTab('exports')} title="Exports" type="button">
          <span className="codicon codicon-export tab-button-icon" aria-hidden />
          Exports
        </button>
      </div>
      <div className="test-flow-tree" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'test' && testTabContent}
        {activeTab === 'load' && loadTabContent}
        {activeTab === 'environment' && environmentTabContent}
        {activeTab === 'exports' && exportsTabContent}
      </div>
    </div>
  );
};

export default LoadTestEdit;
