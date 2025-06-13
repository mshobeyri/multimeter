import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "./markupConvertor";
import APIFieldEditor from "./components/APIEditor";
import { APIData } from "./components/APIData";

interface APIsProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

function yamlToAPI(yamlContent: string): APIData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object") return {} as APIData;
    // Directly map YAML fields to APIField
    return {
      type: doc.type || "",
      title: doc.title || "",
      tags: doc.tags || [],
      description: doc.description,
      inputs: doc.inputs,
      outputs: doc.outputs,
      interfaces: doc.interfaces,
    };
  } catch {
    return {} as APIData;
  }
}

function apiToYaml(api: APIData): string {
  // Directly map APIField fields to YAML
  const yamlObj: Record<string, any> = {
    type: api.type,
    title: api.title,
    tags: api.tags,
  };
  if (api.description) yamlObj.description = api.description;
  if (api.inputs) yamlObj.inputs = api.inputs;
  if (api.outputs) yamlObj.outputs = api.outputs;
  if (api.interfaces) yamlObj.interfaces = api.interfaces;
  return packYaml(yamlObj);
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  const [api, setAPIs] = useState<APIData>({
    type: "",
    title: "",
    tags: [],
    description: "",
    inputs: [],
    outputs: [],
    interfaces: [],
  });
  const lastUpdate = useRef<"yaml" | "ui" | null>(null);

  // Parse YAML to api when content changes (but not if we just updated content from UI)
  useEffect(() => {
    if (lastUpdate.current === "ui") {
      lastUpdate.current = null;
      return;
    }
    setAPIs(yamlToAPI(content));
    lastUpdate.current = "yaml";
  }, [content]);

  // Update YAML when api change (but not if we just updated api from YAML)
  useEffect(() => {
    if (lastUpdate.current === "yaml") {
      lastUpdate.current = null;
      return;
    }
    setContent(apiToYaml(api));
    lastUpdate.current = "ui";
  }, [api, setContent]);

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
      <APIFieldEditor api={api} setAPI={setAPIs} />
    </div>
  );
};

export default APIs;