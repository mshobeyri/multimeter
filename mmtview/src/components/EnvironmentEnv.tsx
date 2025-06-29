import React, { useState } from "react";
import ComboTable, { ComboTablePair } from "./ComboTable";
import { saveEnvVariablesFromObject } from "../workspaceStorage";

const EnvironmentEnv: React.FC = () => {
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);

  // TODO: Load variables/presets from workspace or context here

  const handleVariableChangeAndSave = (name: string, value: string, label?: string) => {
    saveEnvVariablesFromObject({ [name]: { [label ?? value]: value } });
    setVariables(prev =>
      prev.map(pair => pair.name === name ? { ...pair, value } : pair)
    );
  };

  const handlePresetsChange = (presetName: string, envName: string) => {
    // Implement preset logic here and update state as needed
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
        <ComboTable pairs={variables} onChange={handleVariableChangeAndSave} />
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
        <ComboTable pairs={presets} onChange={handlePresetsChange} showPlaceholder />
      </div>
    </div>
  );
};

export default EnvironmentEnv;