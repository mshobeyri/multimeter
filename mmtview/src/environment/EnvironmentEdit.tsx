import React from "react";
import parseYaml, { packYaml } from "mmt-core/markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import EnvironmentCertificatesEdit from "./EnvironmentCertificatesEdit";
import EnvironmentSettingsEdit from "./EnvironmentSettingsEdit";
import { EnvironmentData, EnvCertificates, EnvSetting } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: (value: string) => void;
  tab: "variables" | "presets" | "settings" | "certificates";
}

function packEnvironmentData(envData: EnvironmentData): string {
  const {
    type,
    variables,
    presets,
    setting,
    certificates,
    ...rest
  } = envData as EnvironmentData & Record<string, any>;
  const ordered: Record<string, any> = {};
  ordered.type = type;
  if (variables !== undefined) {
    ordered.variables = variables;
  }
  if (presets !== undefined) {
    ordered.presets = presets;
  }
  if (setting !== undefined) {
    ordered.setting = setting;
  }
  if (certificates !== undefined) {
    ordered.certificates = certificates;
  }
  for (const [key, value] of Object.entries(rest)) {
    ordered[key] = value;
  }
  return packYaml ? packYaml(ordered) : "";
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
    const yamlString = packEnvironmentData(newEnvData);
    setContent(yamlString);
  };

  const handlePresetsChange = (presets: EnvironmentData["presets"]) => {
    if (!envData) return;
    const newEnvData = { ...envData, presets };
    const yamlString = packEnvironmentData(newEnvData);
    setContent(yamlString);
  };

  const handleSettingChange = (setting: EnvSetting) => {
    if (!envData) return;
    const newEnvData = { ...envData, setting };
    const yamlString = packEnvironmentData(newEnvData);
    setContent(yamlString);
  };

  const handleCertificatesChange = (certificates: EnvCertificates) => {
    if (!envData) {
      return;
    }
    const newEnvData = { ...envData, certificates };
    const yamlString = packEnvironmentData(newEnvData);
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
      {tab === "settings" && (
        <EnvironmentSettingsEdit
          setting={envData.setting}
          onChange={handleSettingChange}
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