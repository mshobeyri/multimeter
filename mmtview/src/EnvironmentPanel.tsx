import React, { useEffect, useState } from "react";
import parseYaml from "./yamlparser";

interface ComboTablePair {
  name: string;
  options: string[];
  value: string;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, value: string) => void;
}

const ComboTable: React.FC<ComboTableProps> = ({ pairs, onChange }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <tbody>
      {pairs.map(pair => (
        <tr key={pair.name}>
          <td style={{ padding: "8px" }}>{pair.name}</td>
          <td style={{ padding: "8px" }}>
            <select
              value={pair.value}
              onChange={e => onChange(pair.name, e.target.value)}
              style={{ width: "100%" }}
            >
              {pair.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

interface EnvironmentPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ content, setContent }) => {
  const [variables, setVariables] = useState<ComboTablePair[]>([]);
  const [presets, setPresets] = useState<ComboTablePair[]>([]);

  // Parse YAML and update variables/presets when content changes
  useEffect(() => {
    const yaml = parseYaml(content);
    if (!yaml) return;

    // Variables
    const variablePairs: ComboTablePair[] = [];
    if (yaml.variables) {
      Object.entries(yaml.variables).forEach(([name, value]) => {
        if (Array.isArray(value)) {
          // Array: options are the array values
          variablePairs.push({
            name,
            options: value,
            value: value[0] ?? ""
          });
        } else if (typeof value === "object" && value !== null) {
          // Object: options are the keys
          variablePairs.push({
            name,
            options: Object.keys(value),
            value: Object.keys(value)[0] ?? ""
          });
        }
      });
    }
    setVariables(variablePairs);

    // Presets (flatten all preset environments into one table)
    const presetPairs: ComboTablePair[] = [];
    if (yaml.presets) {
      Object.entries(yaml.presets).forEach(([presetName, presetObj]) => {
        if (typeof presetObj === "object" && presetObj !== null) {
          Object.entries(presetObj).forEach(([envName, envVars]) => {
            if (typeof envVars === "object" && envVars !== null) {
              Object.entries(envVars).forEach(([varName, varValue]) => {
                // Find options for this variable from variables section
                let options: string[] = [];
                const variable = yaml.variables?.[varName];
                if (Array.isArray(variable)) {
                  options = variable;
                } else if (typeof variable === "object" && variable !== null) {
                  options = Object.keys(variable);
                }
                presetPairs.push({
                  name: `${presetName}.${envName}.${varName}`,
                  options,
                  value: String(varValue)
                });
              });
            }
          });
        }
      });
    }
    setPresets(presetPairs);

    window.vscode?.postMessage({ command: "update", text: content });
  }, [content]);

  // Handlers
  const handleVariablesChange = (name: string, value: string) => {
    setVariables(prev =>
      prev.map(pair =>
        pair.name === name ? { ...pair, value } : pair
      )
    );
  };

  const handlePresetsChange = (name: string, value: string) => {
    setPresets(prev =>
      prev.map(pair =>
        pair.name === name ? { ...pair, value } : pair
      )
    );
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