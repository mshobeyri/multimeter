import React from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import EnvironmentVariableEdit from "./EnvironmentVariableEdit";
import { EnvironmentData } from "./EnvironmentData";

interface EnvironmentEditProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentEdit: React.FC<EnvironmentEditProps> = ({ content, setContent }) => {
  let envData: EnvironmentData | null = null;
  try {
    envData = parseYaml(content);
  } catch {
    envData = null;
  }

  const handleVariablesChange = (variables: EnvironmentData["variables"]) => {
    if (!envData) return;
    const newEnvData = { ...envData, variables };
    // Use dumpYaml from markupConvertor instead of js-yaml
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
      <EnvironmentVariableEdit
        variables={envData.variables}
        onChange={handleVariablesChange}
      />
    </div>
  );
};

export default EnvironmentEdit;