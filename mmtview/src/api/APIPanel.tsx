import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import APIFieldEditor from "./APIEditor";
import { APIData } from "./APIData";
import { safeList } from "../safer";

interface APIsProps {
  content: string;
  setContent: (value: string) => void;
}

function yamlToAPI(yamlContent: string): APIData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object") return {} as APIData;
    // Directly map YAML fields to APIField
    return {
      type: doc.type || "",
      title: doc.title || "",
      tags: safeList(doc.tags),
      description: doc.description || "",
      import: safeList(doc.import),
      inputs: safeList(doc.inputs),
      outputs: safeList(doc.outputs),
      setenv: safeList(doc.setenv),
      interfaces: safeList(doc.interfaces),
      examples: safeList(doc.examples),
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
  if (api.import) yamlObj.import = api.import;
  if (api.inputs) yamlObj.inputs = api.inputs;
  if (api.outputs) yamlObj.outputs = api.outputs;
  if (api.setenv) yamlObj.setenv = api.setenv;
  if (api.interfaces) yamlObj.interfaces = api.interfaces;
  if (api.examples) yamlObj.examples = api.examples;
  return packYaml(yamlObj);
}
const defaultAPI: APIData = {
  type: "api",
  title: "",
  tags: [],
  description: "",
  import: [],
  inputs: [],
  outputs: [],
  setenv: [],
  interfaces: [],
  examples: [],
};

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  const [api, setAPIs] = useState<APIData>(defaultAPI);

  // Parse YAML to api when content changes (but not if we just updated content from UI)
  useEffect(() => {
    const newApi = yamlToAPI(content);
    if (newApi == defaultAPI || newApi === api || newApi === {} as APIData) return;
    setAPIs(newApi);
  }, [content]);

  // Update YAML when api change (but not if we just updated api from YAML)
  useEffect(() => {
    const newYaml = apiToYaml(api);
    if (api === defaultAPI || newYaml === content || newYaml === "") {
      return;
    }
    setContent(newYaml);

  }, [api]);

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