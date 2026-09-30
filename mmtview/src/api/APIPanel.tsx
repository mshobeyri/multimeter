import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import APITest from "./APITester";
import YamlErrorWarning from "./YamlErrorWarning";
import { APIData } from "mmt-core/APIData";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import { FileContext } from "../fileContext";

interface APIsProps {
  content: string;
  setContent: (value: string, options?: { force?: boolean }) => void;
  readOnly?: boolean;
  selector?: React.ReactNode;
  initialExampleIndex?: number;
}

const APIs: React.FC<APIsProps> = ({ content, setContent, readOnly = false, selector, initialExampleIndex }) => {
  // Peer model: YAML ↔ tester UI stay in sync. `appliedContent` tracks the
  // last YAML snapshot the right panel is built from; UI writes update both
  // sides immediately, and left-editor YAML changes apply straight through.
  const [appliedContent, setAppliedContent] = useState(content);
  const resolvedContent = useResolvedYamlContent(appliedContent);
  const api = useMemo<APIData>(() => yamlToAPI(resolvedContent), [resolvedContent]);

  const { mmtFilePath } = useContext(FileContext);

  const appliedContentRef = useRef(appliedContent);
  appliedContentRef.current = appliedContent;
  const apiRef = useRef(api);
  apiRef.current = api;

  // Left YAML editor → right panel (no staging / conflict dialog).
  useEffect(() => {
    if (content !== appliedContent) {
      setAppliedContent(content);
      appliedContentRef.current = content;
    }
  }, [content, appliedContent]);

  const setAPI = useCallback((newApi: APIData) => {
    const newYaml = apiToYaml(newApi, appliedContentRef.current);
    apiRef.current = newApi;
    appliedContentRef.current = newYaml;
    setAppliedContent(newYaml);
    setContent(newYaml, { force: true });
  }, [setContent]);

  const update = useCallback((patch: Partial<APIData>) => {
    setAPI({ ...apiRef.current, ...patch });
  }, [setAPI]);

  return (
    <div className="panel is-clip">
      <div className="panel-box is-fill is-flush">
        <div className="apitest-panel-wrapper" key={mmtFilePath}>
          <APITest
            api={api}
            onUpdateApi={readOnly ? undefined : update}
            initialExampleIndex={initialExampleIndex}
            selector={readOnly ? selector : undefined}
            rightOfUrlButton={readOnly ? undefined : <YamlErrorWarning />}
          />
        </div>
      </div>
    </div>
  );
};

export default APIs;
