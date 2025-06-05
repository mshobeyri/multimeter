import React, { useEffect, useState } from "react";
import parseYaml from "./yamlparser";
import ComboTable, { ComboTablePair } from "./components/ComboTable";


interface EnvironmentPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);
  const [presetData, setPresetData] = useState<any>({}); // To keep the parsed preset structure

  // Parse YAML and update variables/presets when content changes
  useEffect(() => {
    const yaml = parseYaml(content);
    if (!yaml) return;

    // Variables
    const variablePairs: ComboTablePair[] = [];
    if (yaml.variables) {
      Object.entries(yaml.variables).forEach(([name, value]) => {
        if (Array.isArray(value)) {
          variablePairs.push({
            name,
            options: value,
            value: value[0] ?? ""
          });
        } else if (typeof value === "object" && value !== null) {
          variablePairs.push({
            name,
            options: Object.keys(value),
            value: Object.keys(value)[0] ?? ""
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

    window.vscode?.postMessage({ command: "update", text: content });
  }, [content]);

  // Handler for variables
  const handleVariablesChange = (name: string, value: string) => {
    setVariables(prev =>
      prev.map(pair =>
        pair.name === name ? { ...pair, value } : pair
      )
    );
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
      setVariables(prev =>
        prev.map(pair =>
          envVars[pair.name]
            ? { ...pair, value: String(envVars[pair.name]) }
            : pair
        )
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px" }}>
      <div
        style={{
          background: "var(--vscode-editorWidget-background, #232323)",
          border: "1px solid var(--vscode-editorWidget-border, #333)",
          borderRadius: "6px",
          padding: "16px",
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: "12px" }}>Variables</div>
        <ComboTable pairs={variables} onChange={handleVariablesChange} />
      </div>
      <div
        style={{
          background: "var(--vscode-editorWidget-background, #232323)",
          border: "1px solid var(--vscode-editorWidget-border, #333)",
          borderRadius: "6px",
          padding: "16px",
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: "12px" }}>Presets</div>
        <ComboTable pairs={presets} onChange={handlePresetsChange} />
      </div>
    </div>
  );
};

export default EnvironmentPanel;