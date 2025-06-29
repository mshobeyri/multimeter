import React, { useEffect, useState } from "react";
import parseYaml from "./markupConvertor";
import ComboTable, { ComboTablePair } from "./components/ComboTable";
import APIOverview from "./components/APIOverview";
import EnvironmentEnv from "./components/EnvironmentEnv";
import EnvironmentEdit from "./components/EnvironmentEdit";
import EnvironmentView from "./components/EnvironmentView";
import { saveEnvVariablesFromObject, loadEnvVariables } from "./workspaceStorage";


interface EnvironmentPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const [tab, setTab] = useState<"environment" | "edit" | "view">("environment");
  const [presetData, setPresetData] = useState<any>({}); 
  const [workspaceVars, setWorkspaceVars] = useState<{ name: string; label: string; value: string }[]>([]);
  const loadedVarsRef = React.useRef<{ name: string; value: string }[]>([]);

  // Parse YAML and update variables/presets when content changes
  useEffect(() => {
    const yaml = parseYaml(content);
    if (!yaml) return;

    const variablePairs: ComboTablePair[] = [];
    if (yaml.variables) {
      Object.entries(yaml.variables).forEach(([name, value]) => {
        const found = loadedVarsRef.current.find((v: any) => v.name === name);
        if (Array.isArray(value)) {
          variablePairs.push({
            name,
            options: value,
            value: found ? found.value : value[0] ?? ""
          });
        } else if (typeof value === "object" && value !== null) {
          const keys = Object.keys(value);
          variablePairs.push({
            name,
            options: keys,
            value: found ? found.value : keys[0] ?? ""
          });
        }
      });
    }
    setVariables(variablePairs);

    // Presets: Each preset group (e.g. runner) is a row, options are environments (dev, ci, cd)
    const presetPairs: ComboTablePair[] = [];
    const presetDataObj: any = {};
    if (yaml.presets) {
      Object.entries(yaml.presets).forEach(([presetName, presetObj]) => {
        if (typeof presetObj === "object" && presetObj !== null) {
          const envNames = Object.keys(presetObj);
          presetPairs.push({
            name: presetName,
            options: envNames,
            value: envNames[0] ?? ""
          });
          presetDataObj[presetName] = presetObj;
        }
      });
    }
    setPresets(presetPairs);
    setPresetData(presetDataObj);
  }, [content]);

  // Handler for variables
  const handleVariablesChange = (name: string, value: string, label?: string) => {
    setVariables(prev => {
      const updated = prev.map(pair =>
        pair.name === name ? { ...pair, value } : pair
      );
      // Save only the selected variable with name, label, value
      // If label is not provided, use value as label (for lists)
      const saveObj: Record<string, any> = {
        [name]: label ? { [label]: value } : [value]
      };
      saveEnvVariablesFromObject(saveObj);
      return updated;
    });
  };

  // Handler for presets: when a preset env is selected, update all variables accordingly
  const handlePresetsChange = (presetName: string, envName: string) => {
    setPresets(prev =>
      prev.map(pair =>
        pair.name === presetName ? { ...pair, value: envName } : pair
      )
    );
    // Update variables based on the selected preset/env
    const envVars = presetData[presetName]?.[envName];

    if (envVars && typeof envVars === "object") {
      setVariables(prev => {
        const updated = prev.map(pair =>
          envVars[pair.name]
            ? { ...pair, value: String(envVars[pair.name]) }
            : pair
        );
        // Save each updated variable with name, label, value
        updated.forEach(pair => {
          const saveObj: Record<string, any> = {
            [pair.name]: pair.options && pair.options.length > 0
              ? [pair.value] // list: label and value are the same
              : { [pair.value]: pair.value } // object: label is value, value is value
          };
          saveEnvVariablesFromObject(saveObj);
        });
        return updated;
      });
    }
  };

  // Load selections from VSCode
  useEffect(() => {
    const cleanup = loadEnvVariables((loaded: { name: string; value: string; }[]) => {
      loadedVarsRef.current = loaded;
      setVariables(vars =>
        vars.map(pair => {
          const found = loadedVarsRef.current.find((v: any) => v.name === pair.name);
          return found ? { ...pair, value: found.value } : pair;
        })
      );
    });
    return cleanup;
  }, []);

  // Load workspace variables for the "view" tab
  useEffect(() => {
    if (tab === "view") {
      const cleanup = loadEnvVariables((loaded: React.SetStateAction<{ name: string; label: string; value: string; }[]>) => {
        setWorkspaceVars(loaded);
      });
      return cleanup;
    }
  }, [tab]);

  return (
    <div
      style={{
        position: "relative",
        background: "var(--vscode-editorWidget-background, #232323)",
        border: "1px solid var(--vscode-editorWidget-border, #333)",
        borderRadius: "6px",
        padding: "16px",
        minWidth: 200,
        marginBottom: "16px"
      }}
    >
      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}>
        <button
          onClick={() => setTab("environment")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "environment" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "environment" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          <span role="img" aria-label="run">🌎</span> Environment
        </button>
        <button
          onClick={() => setTab("edit")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "edit" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "edit" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          <span role="img" aria-label="run">✏️</span> Edit
        </button>
        <button
          onClick={() => setTab("view")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "view" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "view" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          <span role="img" aria-label="run">👁️</span> View Cache
        </button>
      </div>
      {tab === "environment" && (
        <EnvironmentEnv />
      )}
      {tab === "edit" && (
        <EnvironmentEdit content={content} setContent={setContent} />
      )}
      {tab === "view" && (
        <EnvironmentView vars={workspaceVars} />
      )}
    </div>
  );
};

export default EnvironmentPanel;