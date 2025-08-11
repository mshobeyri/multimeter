import React, { useEffect, useRef, useState } from "react";
import parseYaml from "../markupConvertor";
import EnvironmentEnv from "./EnvironmentEnv";
import EnvironmentEdit from "./EnvironmentEdit";
import EnvironmentView from "./EnvironmentView";
import { readEnvironmentVariables, writeEnvironmentVariables, clearEnvironmentVariables } from "./environmentUtils";
import { ComboTablePair } from "../components/ComboTable";
import { isList, safeList } from "../safer";

const LAST_ENV_TAB_KEY = "mmtview:env:lastTab";

interface EnvironmentPanelProps {
  content: string;
  setContent: (value: string) => void;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  // Restore last selected tab from localStorage, default to "environment"
  const [tab, setTab] = useState<"environment" | "edit" | "view">(
    () => (localStorage.getItem(LAST_ENV_TAB_KEY) as "environment" | "edit" | "view") || "environment"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
  const [presetData, setPresetData] = useState<any>({});
  const [workspaceVars, setWorkspaceVars] = useState<{ name: string; label: string; value: string | number | boolean }[]>([]);
  const loadedVarsRef = React.useRef<{ name: string; value: string | number | boolean }[]>([]);

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
      const fullTextWidth = 3 * 140;
      
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
  }, []);

  // Function to refresh workspace variables
  const refreshWorkspaceVars = () => {
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'loadWorkspaceState',
        name: 'multimeter.environment.storage'
      });
    }
  };

  // Parse YAML and update variables/presets when content changes
  useEffect(() => {
    const yaml = parseYaml(content);
    if (!yaml) return;

    const variablePairs: ComboTablePair[] = [];
    const variablesObj = (yaml.variables && typeof yaml.variables === "object") ? yaml.variables : {};
    Object.entries(variablesObj).forEach(([name, value]) => {
      // Ensure loadedVarsRef.current is always an array before calling .find
      const found = Array.isArray(loadedVarsRef.current)
        ? loadedVarsRef.current.find((v: any) => v.name === name)
        : undefined;
      if (isList(value)) {
        const options = value.map((v: string) => ({ label: String(v), value: String(v) }));
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
          value: String(v)
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
          value: { label: envNames[0] ?? "", value: envNames[0] ?? "" }
        });
        presetDataObj[presetName] = presetObj;
      }
    });
    setPresets(presetPairs);
    setPresetData(presetDataObj);
  }, [content]);

  // Handler for variables
  const handleVariablesChange = (name: string, label: string, value: string | number | boolean) => {
    setVariables(prev => {
      const updated = safeList(prev).map(pair => {
        if (pair.name === name) {
          // Find the correct ComboTableOption from options
          const selectedOption = pair.options.find(
            (opt: { label: string; value: string }) => opt.value === value || opt.label === label
          ) || pair.options[0];
          return { ...pair, value: selectedOption };
        }
        return pair;
      });
      // Save all variables at once, each as { name, label, value }
      const flatVars: { name: string; label: string; value: string | number | boolean }[] = [];
      updated.forEach(pair => {
        flatVars.push({
          name: pair.name,
          label: pair.value.label,
          value: pair.value.value
        });
      });

      writeEnvironmentVariables(flatVars);
      return updated;
    });
  };

  // Handler for presets: when a preset env is selected, update all variables accordingly
  const handlePresetsChange = (presetName: string, envName: string) => {
    setPresets(prev =>
      safeList(prev).map(pair =>
        pair.name === presetName ? { ...pair, value: { label: envName, value: envName } } : pair
      )
    );
    // Update variables based on the selected preset/env
    const envVars = presetData[presetName]?.[envName];

    if (envVars && typeof envVars === "object") {
      setVariables(prev => {
        const updated = safeList(prev).map(pair => {
          // For object variables, envVars[pair.name] is the value, pair.options contains {label, value}
          if (envVars[pair.name]) {
            // Try to find the correct option by value or label
            const selected =
              safeList(pair.options).find(
                opt => opt.value === String(envVars[pair.name]) || opt.label === String(envVars[pair.name])
              ) || pair.options[0];
            return { ...pair, value: selected };
          }
          return pair;
        });

        // Save all variables at once, with correct label and value
        const flatVars: { name: string; label: string; value: string | number | boolean }[] = [];
        updated.forEach(pair => {
          flatVars.push({
            name: pair.name,
            label: pair.value.label,
            value: pair.value.value
          });
        });
        writeEnvironmentVariables(flatVars);

        return updated;
      });
    }
  };

  // Load selections from VSCode
  useEffect(() => {
    const cleanup = readEnvironmentVariables((loaded) => {
      loadedVarsRef.current = isList(loaded)
        ? loaded.map(v => ({
          name: v.name,
          label: v.label || v.name,
          value: String(v.value)
        }))
        : [];
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

  // Load workspace variables for the "view" tab - also request initial data
  useEffect(() => {
    if (tab === "view") {
      // Request initial workspace vars
      refreshWorkspaceVars();

      const cleanup = readEnvironmentVariables((loaded) => {
        // loaded: { name: string; value: string | number | boolean }[] | null | undefined
        if (isList(loaded)) {
          setWorkspaceVars(
            loaded.map(v => ({
              name: v.name,
              label: v.label || v.name, // Use label if available, fallback to name
              value: v.value
            }))
          );
        } else {
          setWorkspaceVars([]);
        }
      });
      return cleanup;
    }
  }, [tab]);

  // Add these handler functions in EnvironmentPanel component
  const handleClearCache = () => {
    clearEnvironmentVariables();
    loadedVarsRef.current = [];
    setVariables(prev =>
      safeList(prev).map(pair => ({
        ...pair,
        value: pair.options[0] || { label: "", value: "" }
      }))
    );
    // Clear workspace vars as well
    setWorkspaceVars([]);
  };

  const handleSaveToCache = () => {
    const flatVars: { name: string; label: string; value: string | number | boolean }[] = [];
    variables.forEach(pair => {
      flatVars.push({
        name: pair.name,
        label: pair.value.label,
        value: pair.value.value
      });
    });
    writeEnvironmentVariables(flatVars);
    // Refresh workspace vars after saving
    refreshWorkspaceVars();
  };

  return (
    <div className="panel">
      <div className="panel-box">
        {/* Tab Bar */}
        <div 
          ref={tabContainerRef}
          style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}
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
          <button
            onClick={() => setTab("view")}
            className={`tab-button ${tab === "view" ? "active" : ""}`}
            title={showIconsOnly ? "View Current Vars" : undefined}
          >
            <span className="codicon codicon-eye tab-button-icon"></span>
            {!showIconsOnly && "View Current Vars"}
          </button>
        </div>
        {tab === "environment" && (
          <EnvironmentEnv
            variables={variables}
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
        {tab === "view" && (
          <EnvironmentView
            vars={workspaceVars}
            onClearCache={handleClearCache}
          />
        )}
      </div>
    </div>
  );
};

export default EnvironmentPanel;