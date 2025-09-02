import React, { useEffect, useState } from "react";
import APIFieldEditor from "./APIEditor";
import { APIData } from "./APIData";
import { yamlToAPI, apiToYaml } from "./ParsePack";
interface APIsProps {
  content: string;
  setContent: (value: string) => void;
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  const [api, setAPIs] = useState<APIData>(yamlToAPI(content));

  // Parse YAML to api when content changes (but not if we just updated content from UI)
  useEffect(() => {
    const newApi = yamlToAPI(content);
    if (newApi === api || newApi === {} as APIData) return;
    setAPIs(newApi);
  }, [content]);

  // Update YAML when api change (but not if we just updated api from YAML)
  useEffect(() => {
    const newYaml = apiToYaml(api);
    if (newYaml === content || newYaml === "") {
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