import React from "react";
import parseYaml, { packYaml } from "mmt-core/markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import EnvironmentCertificatesEdit from "./EnvironmentCertificatesEdit";
import { EnvironmentData, EnvCertificates } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: (value: string) => void;
  tab: "variables" | "presets" | "certificates";
}

const EnvironmentEdit: React.FC<EnvironmentEditProps> = ({ content, setContent, tab }) => {

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