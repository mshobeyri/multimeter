import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "./yamlparser";
import VariablesEditor from "./components/VariablesEditor";
import { VariableField } from "./components/VariableEditor";

interface CommonsProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

export type VariablesList = VariableField[];

function yamlToVariables(yamlContent: string): VariablesList {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object" || !doc.variables) return [];
    return Object.entries(doc.variables).map(([key, value]: [string, any]) => ({
      key,
      name: value.name ?? key, // Add name parameter, defaulting to key if not present
      ...value,
    }));
  } catch {
    return [];
  }
}

function variablesToYaml(variables: VariablesList): string {
  const variablesObj: Record<string, any> = {};
  variables.forEach(v => {
    const { key, ...rest } = v;
    // Use the name parameter as the YAML key if present, otherwise fallback to key
    const yamlKey = v.name || key;
    // Remove the name property from the packed value
    const { name, ...packedRest } = rest;
    variablesObj[yamlKey] = packedRest;
  });
  return packYaml({ variables: variablesObj });
}

const Commons: React.FC<CommonsProps> = ({ content, setContent }) => {
  const [variables, setVariables] = useState<VariablesList>([]);
  const lastUpdate = useRef<"yaml" | "ui" | null>(null);

  // Parse YAML to variables when content changes (but not if we just updated content from UI)
  useEffect(() => {
    if (lastUpdate.current === "ui") {
      lastUpdate.current = null;
      return;
    }
    setVariables(yamlToVariables(content));
    lastUpdate.current = "yaml";
  }, [content]);

  // Update YAML when variables change (but not if we just updated variables from YAML)
  useEffect(() => {
    if (lastUpdate.current === "yaml") {
      lastUpdate.current = null;
      return;
    }
    setContent(variablesToYaml(variables));
    lastUpdate.current = "ui";
  }, [variables, setContent]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px" }}>
      <VariablesEditor variables={variables} setVariables={setVariables} />
    </div>
  );
};

export default Commons;