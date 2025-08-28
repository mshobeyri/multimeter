import React, { useEffect, useRef, useState } from "react";
import parseYaml, { packYaml } from "../markupConvertor";
import APIFieldEditor from "./APIEditor";
import { APIData } from "./APIData";
import { safeList, isNonEmptyList, isNonEmptyObject } from "../safer";

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
      description: doc.description || "",
      tags: safeList(doc.tags),
      import: doc.import,
      inputs: doc.inputs,
      outputs: doc.outputs,
      extract: doc.extract,
      setenv: doc.setenv,
      protocol: doc.protocol || "",
      format: doc.format || "",
      url: doc.url || "",
      method: doc.method || "",
      headers: doc.headers || {},
      body: doc.body || "",
      query: doc.query || {},
      cookies: doc.cookies || {},
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
  };
  if (api.description) yamlObj.description = api.description;
  if (isNonEmptyList(api.tags)) yamlObj.tags = api.tags;
  if (isNonEmptyObject(api.import)) yamlObj.import = api.import;
  if (isNonEmptyObject(api.inputs)) yamlObj.inputs = api.inputs;
  if (isNonEmptyObject(api.outputs)) yamlObj.outputs = api.outputs;
  if (isNonEmptyObject(api.extract)) yamlObj.extract = api.extract;
  if (isNonEmptyObject(api.setenv)) yamlObj.setenv = api.setenv;
  if (api.protocol) yamlObj.protocol = api.protocol;
  if (api.format) yamlObj.format = api.format;
  if (api.url) yamlObj.url = api.url;
  if (api.method) yamlObj.method = api.method;
  if (isNonEmptyObject(api.headers)) yamlObj.headers = api.headers;
  if (api.body && api.body !== "") yamlObj.body = api.body;
  if (isNonEmptyObject(api.query)) yamlObj.query = api.query;
  if (isNonEmptyObject(api.cookies)) yamlObj.cookies = api.cookies;
  if (isNonEmptyList(api.examples)) yamlObj.examples = api.examples;
  return packYaml(yamlObj);
}
const defaultAPI: APIData = {
  type: "api",
  title: "",
  description: "",
  tags: [],
  import: {},
  inputs: {},
  outputs: {},
  extract: {},
  setenv: {},
  protocol: "http",
  format: "json",
  url: "",
  method: "get",
  headers: {},
  body: "",
  query: {},
  cookies: {},
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
    <div className="panel">
      <APIFieldEditor api={api} setAPI={setAPIs} />
    </div>
  );
};

export default APIs;