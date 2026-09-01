import React from "react";
import parseYaml from "mmt-core/markupConvertor";
import { patchEnvYaml } from "mmt-core/envParsePack";
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
    setContent(patchEnvYaml(content, {
      import: Object.keys(imports).length > 0 ? imports : undefined,
    }));
  };

  const handleVariablesChange = (variables: EnvironmentData["variables"]) => {
    setContent(patchEnvYaml(content, { variables }));
  };

  const handlePresetsChange = (presets: EnvironmentData["presets"]) => {
    setContent(patchEnvYaml(content, { presets }));
  };

  const handleSettingChange = (setting: EnvSetting) => {
    setContent(patchEnvYaml(content, { setting }));
  };

  const handleCertificatesChange = (certificates: EnvCertificates) => {
    setContent(patchEnvYaml(content, { certificates }));
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