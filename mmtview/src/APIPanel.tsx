import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "./yamlparser";
import APIFieldEditor, {APIField} from "./components/APIEditor";

interface APIsProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

function yamlToAPI(yamlContent: string): APIField {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== "object") return {} as APIField;
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
    return {} as APIField;
  }
}

function apiToYaml(api: APIField): string {
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
  const [api, setAPIs] = useState<APIField>({
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
        gap: "24px",
        padding: "10px",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div style={{ height: 50, flexShrink: 0 }} />
      <APIFieldEditor api={api} setAPI={setAPIs} />
    </div>
  );
};

export default APIs;