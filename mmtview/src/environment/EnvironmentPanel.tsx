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

const LAST_ENV_PAGE_KEY = "mmtview:env:lastPage";

interface EnvironmentPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const [page, setPage] = useState<'environment' | 'edit'>(
    () => (localStorage.getItem(LAST_ENV_PAGE_KEY) as 'environment' | 'edit') || 'environment'
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
  const [presetData, setPresetData] = useState<any>({});
  const [variableDefinitions, setVariableDefinitions] = useState<Record<string, any>>({});
  const [workspaceVars, setWorkspaceVars] = useState<EnvVariable[]>([]);
  const [certificates, setCertificates] = useState<EnvCertificates | undefined>(undefined);
  const loadedVarsRef = React.useRef<{ name: string; value: JSONValue, options: JSONValue[] }[]>([]);

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

  // (no tab-bar on first page; leave showIconsOnly unused for now)

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

  // Parse YAML and update variables/presets when content changes
  useEffect(() => {
    const yaml = parseYaml(content);
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
  }, [content]);

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
          const resolvedValue = selectFromVariables(variableDefinitions, pair.name, choice);
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

  const applyPresetsToVariables = useCallback((currentPairs: ComboTablePair[]): ComboTablePair[] => {
    let updatedPairs = safeList(currentPairs).map(pair => ({ ...pair }));
    safeList(presets).forEach(preset => {
      const selection = preset.value?.value || preset.value?.label;
      if (!selection) {
        return;
      }
      const mapping = presetData?.[preset.name]?.[selection];
      if (!mapping || typeof mapping !== "object") {
        return;
      }
      updatedPairs = safeList(updatedPairs).map(pair => {
        if (!Object.prototype.hasOwnProperty.call(mapping, pair.name)) {
          return pair;
        }
        const choice = mapping[pair.name];
        const resolvedValue = selectFromVariables(variableDefinitions, pair.name, choice);
        const nextOption = safeList(pair.options).find(opt =>
          opt.value === resolvedValue ||
          opt.label === resolvedValue ||
          String(opt.value) === String(resolvedValue)
        );
        if (nextOption) {
          return { ...pair, value: nextOption };
        }
        const fallback = pair.options[0];
        if (fallback) {
          return { ...pair, value: fallback };
        }
        return pair;
      });
    });
    return updatedPairs;
  }, [presets, presetData, variableDefinitions]);

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
        options: Array.isArray(v.options) ? v.options.map(opt => typeof opt === "object" && "value" in opt ? opt.value : opt) : []
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
            const selectedOption =
              safeList(pair.options).find(opt => opt.value === found.value) ||
              pair.options[0];
            return { ...pair, value: selectedOption };
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
    setVariables(prev => {
      const applied = applyPresetsToVariables(prev);
      const flatVars = toEnvVariables(applied);
      writeEnvironmentVariables(flatVars);
      saveEnvPresets(presetData);
      setWorkspaceVars(flatVars);
      return applied;
    });
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
                  <div className="tab-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <EnvironmentEnv
                    variables={variables}
                    currentVariables={workspaceVars}
                    presets={presets}
                    handleVariablesChange={handleVariablesChange}
                    handlePresetsChange={handlePresetsChange}
                    onClearCache={handleClearCache}
                    onSaveToCache={handleSaveToCache}
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
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <EnvironmentEdit content={content} setContent={setContent} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentPanel;