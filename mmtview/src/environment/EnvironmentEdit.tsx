import React from "react";
import parseYaml, { packYaml } from "mmt-core/markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import EnvironmentPresetEdit from "./EnvironmentPresetEdit";
import EnvironmentCertificatesEdit from "./EnvironmentCertificatesEdit";
import EnvironmentSettingsEdit from "./EnvironmentSettingsEdit";
import { EnvironmentData, EnvCertificates, EnvSetting } from "./EnvironmentData";
import KSVEditor from "../components/KSVEditor";
import { useResolvedYamlContent } from "../useResolvedYamlContent";

interface EnvironmentEditProps {
  content: string;
  setContent: (value: string) => void;
  tab: "overview" | "variables" | "presets" | "settings" | "certificates";
}

function packEnvironmentData(envData: EnvironmentData): string {
  const {
    type,
    import: imports,
    variables,
    presets,
    setting,
    certificates,
    ...rest
  } = envData as EnvironmentData & Record<string, any>;
  const ordered: Record<string, any> = {};
  ordered.type = type;
  if (imports !== undefined && Object.keys(imports).length > 0) {
    ordered.import = imports;
  }
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
  const resolvedContent = useResolvedYamlContent(content);

  let envData: EnvironmentData | null = null;
  let resolvedEnvData: EnvironmentData | null = null;
  try {
    envData = parseYaml(content);
    resolvedEnvData = parseYaml(resolvedContent);
  } catch {
    envData = null;
    resolvedEnvData = null;
  }

  const handleImportsChange = (imports: Record<string, string>) => {
    if (!envData) return;
    const newEnvData = { ...envData, import: Object.keys(imports).length > 0 ? imports : undefined };
    const yamlString = packEnvironmentData(newEnvData);
    setContent(yamlString);
  };

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
      {tab === "overview" && (
        <div style={{ padding: "0 16px 8px" }}>
          <KSVEditor
            label="Import"
            value={envData.import}
            onChange={handleImportsChange}
            keyPlaceholder="alias"
            valuePlaceholder="path"
            filePicker={true}
            filePickerFilters={[
              { name: "Data files", extensions: ["json", "yaml", "yml", "csv"] },
            ]}
          />
        </div>
      )}
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
          setting={resolvedEnvData?.setting ?? envData.setting}
          onChange={handleSettingChange}
        />
      )}
      {tab === "certificates" && (
        <EnvironmentCertificatesEdit
          certificates={resolvedEnvData?.certificates ?? envData.certificates}
          onChange={handleCertificatesChange}
        />
      )}
    </div>
  );
};

export default EnvironmentEdit;