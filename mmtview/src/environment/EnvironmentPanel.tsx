import React, { useCallback, useEffect, useState } from "react";
import parseYaml from "mmt-core/markupConvertor";
import EnvironmentEnv from "./EnvironmentEnv";
import EnvironmentEdit from "./EnvironmentEdit";
import { readEnvironmentVariables, writeEnvironmentVariables, clearEnvironmentVariables } from "./environmentUtils";
import { ComboTablePair } from "../components/ComboTable";
import { isList, safeList } from "mmt-core/safer";
import { JSONValue } from "mmt-core/CommonData";
import { EnvCertificates, EnvVariable } from "./EnvironmentData";
import { saveEnvPresets } from "../workspaceStorage";
import { selectFromVariables } from "mmt-core/runConfig";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import TabBar from "../components/TabBar";
import PrimaryButton from "../components/PrimaryButton";

const LAST_ENV_PAGE_KEY = "mmtview:env:lastPage";

const ENV_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "note" },
  { id: "variables" as const, label: "Variables", icon: "symbol-variable" },
  { id: "presets" as const, label: "Presets", icon: "tasklist" },
  { id: "settings" as const, label: "Settings", icon: "settings-gear" },
  { id: "certificates" as const, label: "Certificates", icon: "shield" },
];

interface EnvironmentPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const resolvedContent = useResolvedYamlContent(content);
  const [page, setPage] = useState<'environment' | 'edit'>(
    () => (localStorage.getItem(LAST_ENV_PAGE_KEY) as 'environment' | 'edit') || 'environment'
  );
  const [editTab, setEditTab] = useState<'overview' | 'variables' | 'presets' | 'settings' | 'certificates'>('overview');
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
  const [presetData, setPresetData] = useState<any>({});
  const [variableDefinitions, setVariableDefinitions] = useState<Record<string, any>>({});
  const [workspaceVars, setWorkspaceVars] = useState<EnvVariable[]>([]);
  const [certificates, setCertificates] = useState<EnvCertificates | undefined>(undefined);
  const loadedVarsRef = React.useRef<{ name: string; value: JSONValue, options: Array<{label: string; value: JSONValue}> }[]>([]);

  const refreshWorkspaceVars = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'loadWorkspaceState',
        name: 'multimeter.environment.storage'
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LAST_ENV_PAGE_KEY, page);
  }, [page]);

  // Add event listener for environment variable refresh messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'multimeter.environment.refresh') {
        refreshWorkspaceVars();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [refreshWorkspaceVars]);

  useEffect(() => {
    refreshWorkspaceVars();
  }, [refreshWorkspaceVars]);

  // Parse resolved YAML so imported ${alias.path} values appear in the UI.
  useEffect(() => {
    const yaml = parseYaml(resolvedContent);
    if (!yaml) return;

    setCertificates(yaml.certificates as EnvCertificates | undefined);

    const variablePairs: ComboTablePair[] = [];
    const variablesObj = (yaml.variables && typeof yaml.variables === "object") ? yaml.variables : {};
    setVariableDefinitions(variablesObj as Record<string, any>);
    Object.entries(variablesObj).forEach(([name, value]) => {
      // Ensure loadedVarsRef.current is always an array before calling .find
      const found = Array.isArray(loadedVarsRef.current)
        ? loadedVarsRef.current.find((v: any) => v.name === name)
        : undefined;
      if (isList(value)) {
        const options = value.map((v: string) => ({ label: String(v), value: String(v), options: [] }));
        const selected = found
          ? options.find(opt => opt.value === found.value) || options[0]
          : options[0];
        variablePairs.push({
          name,
          options,
          value: selected
        });
      } else if (typeof value === "object" && value !== null) {
        const options = Object.entries(value).map(([k, v]) => ({
          label: k,
          value: v
        }));
        let selected = options[0];
        if (found) {
          selected =
            options.find(opt => opt.label === found.value || opt.value === found.value) ||
            options[0];
        }
        variablePairs.push({
          name,
          options,
          value: selected
        });
      }
    });
    setVariables(variablePairs);

    // Presets
    const presetPairs: ComboTablePair[] = [];
    const presetDataObj: any = {};
    const presetsObj = (yaml.presets && typeof yaml.presets === "object") ? yaml.presets : {};
    Object.entries(presetsObj).forEach(([presetName, presetObj]) => {
      if (typeof presetObj === "object" && presetObj !== null) {
        const envNames = Object.keys(presetObj);
        presetPairs.push({
          name: presetName,
          options: safeList(envNames).map(env => ({ label: env, value: env })),
          value: { label: "", value: "" }
        });
        presetDataObj[presetName] = presetObj;
      }
    });
    setPresets(presetPairs);
    setPresetData(presetDataObj);
  }, [resolvedContent]);

  // Handler for variables
  const handleVariablesChange = (variable: EnvVariable) => {
    setVariables(prev => {
      const updated = safeList(prev).map(pair => {
        if (pair.name === variable.name) {
          // Find the correct ComboTableOption from options
          const selectedOption = pair.options.find(
            (opt: { label: string; value: JSONValue }) => opt.value === variable.value || opt.label === variable.label
          ) || pair.options[0];
          return { ...pair, value: selectedOption, options: pair.options };
        }
        return pair;
      });
      const flatVars: EnvVariable[] = [];
      updated.forEach(pair => {
        flatVars.push({
          name: pair.name,
          label: pair.value.label,
          value: pair.value.value,
          options: pair.options
        });
      });

      writeEnvironmentVariables(flatVars);
      setWorkspaceVars(flatVars);
      return updated;
    });
  };

  const handlePresetsChange = (presetName: string, envName: string) => {
    setPresets(prev =>
      safeList(prev).map(pair =>
        pair.name === presetName ? { ...pair, value: { label: envName, value: envName } } : pair
      )
    );
    const mapping = presetData?.[presetName]?.[envName];
    if (mapping && typeof mapping === "object") {
      setVariables(prev => {
        const updated = safeList(prev).map(pair => {
          if (!Object.prototype.hasOwnProperty.call(mapping, pair.name)) {
            return pair;
          }
          const choice = mapping[pair.name];
          const resolvedValue =
            safeList(pair.options).find(opt => opt.label === choice)?.value ??
            selectFromVariables(variableDefinitions, pair.name, choice);
          const nextOption = safeList(pair.options).find(opt =>
            opt.value === resolvedValue ||
            opt.label === resolvedValue ||
            String(opt.value) === String(resolvedValue)
          );
          if (nextOption) {
            return { ...pair, value: nextOption };
          }
          const fallback = pair.options[0];
          return fallback ? { ...pair, value: fallback } : pair;
        });
        const flatVars = toEnvVariables(updated);
        writeEnvironmentVariables(flatVars);
        setWorkspaceVars(flatVars);
        return updated;
      });
    }
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'multimeter.environment.applyPreset',
        presetName,
        envName
      });
    }
  };

  const toEnvVariables = (pairs: ComboTablePair[]): EnvVariable[] =>
    safeList(pairs).map(pair => ({
      name: pair.name,
      label: pair.value?.label ?? pair.name,
      value: pair.value?.value ?? "",
      options: Array.isArray(pair.options)
        ? pair.options.filter((opt: any): opt is { label: string; value: JSONValue } => !!opt && typeof opt === "object" && "label" in opt && "value" in opt)
        : []
    }));

  // Load selections from VSCode
  useEffect(() => {
    const cleanup = readEnvironmentVariables((loaded) => {
      const safeLoaded = isList(loaded) ? loaded : [];
      loadedVarsRef.current = safeLoaded.map(v => ({
        name: v.name,
        value: v.value,
        options: Array.isArray(v.options) ? v.options : []
      }));
      setWorkspaceVars(safeLoaded.map(v => ({
        name: v.name,
        label: v.label || v.name,
        value: v.value,
        options: v.options || []
      })));
      setVariables(vars =>
        safeList(vars).map(pair => {
          const found = isList(loadedVarsRef.current)
            ? loadedVarsRef.current.find((v: any) => v.name === pair.name)
            : undefined;
          if (found) {
            const resolvedOptions = Array.isArray(found.options) && found.options.length > 0
              ? found.options
              : pair.options;
            const selectedOption =
              safeList(resolvedOptions).find(opt => opt.value === found.value) ||
              resolvedOptions[0];
            return { ...pair, options: resolvedOptions, value: selectedOption };
          }
          return pair;
        })
      );
    });
    return cleanup;
  }, []);

  // Add these handler functions in EnvironmentPanel component
  const handleClearCache = () => {
    clearEnvironmentVariables();
    saveEnvPresets({});
    loadedVarsRef.current = [];
    setWorkspaceVars([]);
    refreshWorkspaceVars();
  };

  const handleSaveToCache = () => {
    const yaml = parseYaml(resolvedContent);
    if (!yaml) {
      return;
    }
    const variablesObj = (yaml.variables && typeof yaml.variables === "object") ? yaml.variables : {};
    setVariableDefinitions(variablesObj as Record<string, any>);
    const rebuiltPairs: ComboTablePair[] = [];
    Object.entries(variablesObj).forEach(([name, value]) => {
      if (isList(value)) {
        const options = value.map((v: string) => ({ label: String(v), value: String(v), options: [] }));
        rebuiltPairs.push({ name, options, value: options[0] });
      } else if (typeof value === "object" && value !== null) {
        const options = Object.entries(value).map(([k, v]) => ({ label: k, value: v }));
        rebuiltPairs.push({ name, options, value: options[0] });
      } else {
        const scalar = { label: String(value), value: value as JSONValue };
        rebuiltPairs.push({
          name,
          options: [scalar],
          value: scalar,
        });
      }
    });
    let applied = rebuiltPairs;
    safeList(presets).forEach(preset => {
      const selection = preset.value?.value || preset.value?.label;
      if (!selection) {
        return;
      }
      const mapping = presetData?.[preset.name]?.[selection];
      if (!mapping || typeof mapping !== "object") {
        return;
      }
      applied = safeList(applied).map(pair => {
        if (!Object.prototype.hasOwnProperty.call(mapping, pair.name)) {
          return pair;
        }
        const choice = mapping[pair.name];
        const resolvedValue =
          safeList(pair.options).find(opt => opt.label === choice)?.value ??
          selectFromVariables(variablesObj as Record<string, any>, pair.name, choice);
        const nextOption = safeList(pair.options).find(opt =>
          opt.value === resolvedValue ||
          opt.label === resolvedValue ||
          String(opt.value) === String(resolvedValue)
        );
        if (nextOption) {
          return { ...pair, value: nextOption };
        }
        const fallback = pair.options[0];
        return fallback ? { ...pair, value: fallback } : pair;
      });
    });
    const flatVars = toEnvVariables(applied);
    writeEnvironmentVariables(flatVars);
    saveEnvPresets(presetData);
    setWorkspaceVars(flatVars);
    loadedVarsRef.current = flatVars.map(v => ({
      name: v.name,
      value: v.value,
      options: Array.isArray(v.options) ? v.options : [],
    }));
    setVariables(applied);
    if (window.vscode) {
      window.vscode.postMessage({ command: 'reloadWorkspaceEnv' });
    }
    refreshWorkspaceVars();
  };

  return (
    <div className="panel">
      <div className="panel-box" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'environment' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div className="api-edit-header">
                  <div className="tab-bar tab-bar-single" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="tab-button active" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="codicon codicon-server-environment" aria-hidden />
                      Environment
                    </div>
                    <button
                      className="action-button api-edit-launcher"
                      onClick={() => setPage('edit')}
                      title="Edit Environment"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                      <span className="api-edit-launcher-text">Edit Environment</span>
                    </button>
                  </div>
                </div>
                <div className="run-action-bar">
                  <PrimaryButton icon="refresh" onClick={handleSaveToCache}>
                    Reload
                  </PrimaryButton>
                  <PrimaryButton icon="clear-all" onClick={handleClearCache}>
                    Clear
                  </PrimaryButton>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <EnvironmentEnv
                    variables={variables}
                    currentVariables={workspaceVars}
                    presets={presets}
                    handleVariablesChange={handleVariablesChange}
                    handlePresetsChange={handlePresetsChange}
                    clients={certificates?.clients}
                  />
                </div>
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('environment')}
                    title="Back to Environment"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit Environment</div>
                </div>
                <TabBar tabs={ENV_EDIT_TABS} value={editTab} onChange={setEditTab} />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <EnvironmentEdit content={content} setContent={setContent} tab={editTab} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentPanel;