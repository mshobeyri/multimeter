import React, { useState } from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import { EnvironmentData } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: (value: string) => void;
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
      <div className="tab-bar">
        <button
          onClick={() => setTab("variables")}
          className={`tab-button-small ${tab === "variables" ? "active" : ""}`}
        >
          Variables
        </button>
        <button
          onClick={() => setTab("presets")}
          className={`tab-button-small ${tab === "presets" ? "active" : ""}`}
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