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
  const [variables, setVariables] = useState<ComboTablePair[]>([
    { name: "test_type", options: ["smoke", "regression", "load"], value: "smoke" },
    { name: "endpoint", options: ["st", "et", "pr"], value: "st" },
    { name: "certificate", options: ["cert1", "cert2"], value: "cert1" }
  ]);
  const [presets, setPresets] = useState<ComboTablePair[]>([
    { name: "runner", options: ["dev", "ci", "cd"], value: "dev" }
  ]);

  useEffect(() => {
    let res = parseYaml(content);
    window.vscode?.postMessage({ command: "update", text: content });
  }, [content]);

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