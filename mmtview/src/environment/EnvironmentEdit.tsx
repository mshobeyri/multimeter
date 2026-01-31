import React, { useState } from "react";
import parseYaml, { packYaml } from "mmt-core/markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import EnvironmentCertificatesEdit from "./EnvironmentCertificatesEdit";
import { EnvironmentData, EnvCertificates } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: (value: string) => void;
}

const EnvironmentEdit: React.FC<EnvironmentEditProps> = ({ content, setContent }) => {
  const [tab, setTab] = useState<"variables" | "presets" | "certificates">("variables");

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

  const handleCertificatesChange = (certificates: EnvCertificates) => {
    if (!envData) {
      return;
    }
    const newEnvData = { ...envData, certificates };
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
          className={`tab-button ${tab === "variables" ? "active" : ""}`}
          title="Variables"
          type="button"
        >
          <span className="codicon codicon-symbol-variable tab-button-icon"></span>
          Variables
        </button>
        <button
          onClick={() => setTab("presets")}
          className={`tab-button ${tab === "presets" ? "active" : ""}`}
          title="Presets"
          type="button"
        >
          <span className="codicon codicon-tasklist tab-button-icon"></span>
          Presets
        </button>
        <button
          onClick={() => setTab("certificates")}
          className={`tab-button ${tab === "certificates" ? "active" : ""}`}
          title="Certificates"
          type="button"
        >
          <span className="codicon codicon-shield tab-button-icon"></span>
          Certificates
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
      {tab === "certificates" && (
        <EnvironmentCertificatesEdit
          certificates={envData.certificates}
          onChange={handleCertificatesChange}
        />
      )}
    </div>
  );
};

export default EnvironmentEdit;