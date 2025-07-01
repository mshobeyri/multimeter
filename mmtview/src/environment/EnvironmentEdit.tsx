import React, { useState } from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import { EnvironmentData } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentEdit: React.FC<EnvironmentEditProps> = ({ content, setContent }) => {
  const [tab, setTab] = useState<"variables" | "presets">("variables");

  let envData: EnvironmentData | null = null;
  try {
    envData = parseYaml(content);
  } catch {
    envData = null;
  }

  const handleVariablesChange = (variables: EnvironmentData["variables"]) => {
    if (!envData) return;
    const newEnvData = { ...envData, variables };
    const yamlString = packYaml ? packYaml(newEnvData) : content;
    setContent(yamlString);
  };

  const handlePresetsChange = (presets: EnvironmentData["presets"]) => {
    if (!envData) return;
    const newEnvData = { ...envData, presets };
    const yamlString = packYaml ? packYaml(newEnvData) : content;
    setContent(yamlString);
  };

  if (!envData) {
    return (
      <div style={{ color: "#f55", padding: 16 }}>
        Invalid YAML or no environment data found.
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 12 }}>
        <button
          onClick={() => setTab("variables")}
          style={{
            padding: "6px 18px",
            border: "none",
            borderBottom: tab === "variables" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "variables" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Variables
        </button>
        <button
          onClick={() => setTab("presets")}
          style={{
            padding: "6px 18px",
            border: "none",
            borderBottom: tab === "presets" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "presets" ? "bold" : "normal",
            cursor: "pointer"
          }}
        >
          Presets
        </button>
      </div>
      {tab === "variables" && (
        <EnvironmentVariableEdit
          variables={envData.variables}
          onChange={handleVariablesChange}
        />
      )}
      {tab === "presets" && (
        <EnvironmentPresetEdit
          presets={envData.presets || {}}
          onChange={handlePresetsChange}
        />
      )}
    </div>
  );
};

export default EnvironmentEdit;