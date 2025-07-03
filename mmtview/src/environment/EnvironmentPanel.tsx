import React, { useEffect, useState } from "react";
import parseYaml from "../markupConvertor";
import EnvironmentEnv from "./EnvironmentEnv";
import EnvironmentEdit from "./EnvironmentEdit";
import EnvironmentView from "./EnvironmentView";
import { saveEnvVariablesFromObject, loadEnvVariables } from "../workspaceStorage";
import { ComboTablePair } from "../components/ComboTable";


interface EnvironmentPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const [tab, setTab] = useState<"environment" | "edit" | "view">("environment");
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
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
          // List: label and value are the same (element)
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
          // Object: label is key, value is value
          const options = Object.entries(value).map(([k, v]) => ({
            label: k,
            value: String(v)
          }));
          // Try to find by label or value
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
            options: envNames.map(env => ({ label: env, value: env })),
            value: { label: envNames[0] ?? "", value: envNames[0] ?? "" }
          });
          presetDataObj[presetName] = presetObj;
        }
      });
    }
    setPresets(presetPairs);
    setPresetData(presetDataObj);
  }, [content]);

  // Handler for variables
  const handleVariablesChange = (name: string, label: string, value: string) => {
    setVariables(prev => {
      const updated = prev.map(pair => {
        if (pair.name === name) {
          // Find the correct ComboTableOption from options
          const selectedOption = pair.options.find(
            opt => opt.value === value || opt.label === label
          ) || pair.options[0];
          return { ...pair, value: selectedOption };
        }
        return pair;
      });

      // Save all variables at once, each as { name, label, value }
      const flatVars: { name: string; label: string; value: string }[] = [];
      updated.forEach(pair => {
        flatVars.push({
          name: pair.name,
          label: pair.value.label,
          value: pair.value.value
        });
      });

      saveEnvVariablesFromObject(flatVars);
      console.log("Updated environment variables:", flatVars);
      return updated;
    });
  };

  // Handler for presets: when a preset env is selected, update all variables accordingly
  const handlePresetsChange = (presetName: string, envName: string) => {
    setPresets(prev =>
      prev.map(pair =>
        pair.name === presetName ? { ...pair, value: { label: envName, value: envName } } : pair
      )
    );
    // Update variables based on the selected preset/env
    const envVars = presetData[presetName]?.[envName];

    if (envVars && typeof envVars === "object") {
      setVariables(prev => {
        const updated = prev.map(pair => {
          // For object variables, envVars[pair.name] is the value, pair.options contains {label, value}
          if (envVars[pair.name]) {
            // Try to find the correct option by value or label
            const selected =
              pair.options.find(
                opt => opt.value === String(envVars[pair.name]) || opt.label === String(envVars[pair.name])
              ) || pair.options[0];
            return { ...pair, value: selected };
          }
          return pair;
        });

        // Save all variables at once, with correct label and value
        const flatVars: { name: string; label: string; value: string }[] = [];
        updated.forEach(pair => {
          flatVars.push({
            name: pair.name,
            label: pair.value.label,
            value: pair.value.value
          });
        });
        saveEnvVariablesFromObject(flatVars);

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
          if (found) {
            const selectedOption =
              pair.options.find(opt => opt.value === found.value || opt.label === found.value) ||
              pair.options[0];
            return { ...pair, value: selectedOption };
          }
          return pair;
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
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        minWidth: 100,
        maxWidth: "80vw",
        overflow: "auto",
        height: "100%",
      }}
    >
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
          <EnvironmentEnv
            variables={variables}
            presets={presets}
            handleVariablesChange={handleVariablesChange}
            handlePresetsChange={handlePresetsChange}
          />
        )}
        {tab === "edit" && (
          <EnvironmentEdit content={content} setContent={setContent} />
        )}
        {tab === "view" && (
          <EnvironmentView vars={workspaceVars} />
        )}
      </div>
    </div>
  );
};

export default EnvironmentPanel;