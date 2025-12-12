import React, { useCallback, useEffect, useRef, useState } from "react";
import parseYaml from "mmt-core/markupConvertor";
import EnvironmentEnv from "./EnvironmentEnv";
import EnvironmentEdit from "./EnvironmentEdit";
import { readEnvironmentVariables, writeEnvironmentVariables, clearEnvironmentVariables } from "./environmentUtils";
import { ComboTablePair } from "../components/ComboTable";
import { isList, safeList } from "mmt-core/safer";
import { JSONValue } from "mmt-core/CommonData";
import { EnvVariable } from "./EnvironmentData";
import { saveEnvPresets } from "../workspaceStorage";
import { selectFromVariables } from "mmt-core/runConfig";

const LAST_ENV_TAB_KEY = "mmtview:env:lastTab";

interface EnvironmentPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  // Restore last selected tab from localStorage, default to "environment"
  const [tab, setTab] = useState<"environment" | "edit">(() => {
    const stored = localStorage.getItem(LAST_ENV_TAB_KEY);
    if (stored === "edit") {
      return "edit";
    }
    return "environment";
  });
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
  const [presetData, setPresetData] = useState<any>({});
  const [variableDefinitions, setVariableDefinitions] = useState<Record<string, any>>({});
  const [workspaceVars, setWorkspaceVars] = useState<EnvVariable[]>([]);
  const loadedVarsRef = React.useRef<{ name: string; value: JSONValue, options: JSONValue[] }[]>([]);

  const refreshWorkspaceVars = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'loadWorkspaceState',
        name: 'multimeter.environment.storage'
      });
    }
  }, []);

  // Save tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LAST_ENV_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) return;

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      // Calculate approximate width needed for full text tabs
      // Rough estimate: 140px per tab for text + icon
      const fullTextWidth = 2 * 140;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

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
      <div className="panel-box">
        <div
          ref={tabContainerRef}
          className="tab-bar"
        >
          <button
            onClick={() => setTab("environment")}
            className={`tab-button ${tab === "environment" ? "active" : ""}`}
            title={showIconsOnly ? "Environment" : undefined}
          >
            <span className="codicon codicon-globe tab-button-icon"></span>
            {!showIconsOnly && "Environment"}
          </button>
          <button
            onClick={() => setTab("edit")}
            className={`tab-button ${tab === "edit" ? "active" : ""}`}
            title={showIconsOnly ? "Edit" : undefined}
          >
            <span className="codicon codicon-edit tab-button-icon"></span>
            {!showIconsOnly && "Edit"}
          </button>
        </div>
        {tab === "environment" && (
          <EnvironmentEnv
            variables={variables}
            currentVariables={workspaceVars}
            presets={presets}
            handleVariablesChange={handleVariablesChange}
            handlePresetsChange={handlePresetsChange}
            onClearCache={handleClearCache}
            onSaveToCache={handleSaveToCache}
          />
        )}
        {tab === "edit" && (
          <EnvironmentEdit content={content} setContent={setContent} />
        )}
      </div>
    </div>
  );
};

export default EnvironmentPanel;