import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "./markupConvertor";
import VariablesEditor from "./components/VariablesEditor";
import { Variable, VariablesData } from "./components/VariablesData";

interface VariablesProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

function yamlToVariables(yamlContent: string): VariablesData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object") return {} as VariablesData;
    return {
      type: doc.type || "",
      variables: doc.variables || {},
    };
  } catch {
    return {} as VariablesData;
  }
}

function variablesToYaml(variablesData: VariablesData): string {
  const yamlObj: Record<string, any> = {};
  if (variablesData.type) yamlObj.type = variablesData.type;
  yamlObj.variables = variablesData.variables;
  return packYaml(yamlObj);
}

const VariablesPanel: React.FC<VariablesProps> = ({ content, setContent }) => {
  const [variablesData, setVariablesData] = useState<VariablesData>({
    type: "var",
    variables: [],
  });
  const lastUpdate = useRef<"yaml" | "ui" | null>(null);

  // Parse YAML to variablesData when content changes (but not if we just updated content from UI)
  useEffect(() => {
    if (lastUpdate.current === "ui") {
      lastUpdate.current = null;
      return;
    }
    setVariablesData(yamlToVariables(content));
    lastUpdate.current = "yaml";
  }, [content]);

  // Update YAML when variablesData changes (but not if we just updated variablesData from YAML)
  useEffect(() => {
    if (lastUpdate.current === "yaml") {
      lastUpdate.current = null;
      return;
    }
    setContent(variablesToYaml(variablesData));
    lastUpdate.current = "ui";
  }, [variablesData, setContent]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        minWidth: 100,
        maxWidth: "80vw",
        overflow: "auto",
        height: "100%",
      }}
    >
      <VariablesEditor
        variablesData={variablesData}
        setVariablesData={setVariablesData}
      />
      <div style={{ height: 50, flexShrink: 0 }} />
    </div>
  );
};

export default VariablesPanel;