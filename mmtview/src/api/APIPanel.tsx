import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import APIOverview from "./APIOverview";
import APITest from "./APITester";
import YamlErrorWarning from "./YamlErrorWarning";
import { APIData } from "mmt-core/APIData";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import { usePanelPage } from "../usePanelPage";
import { FileContext } from "../fileContext";
import PanelEditHeader from "../components/PanelEditHeader";
import { HeaderAction } from "../components/PanelRunHeader";

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

  const [page, setPage] = usePanelPage<"test" | "edit">("test");
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

  useEffect(() => {
    if (readOnly && page !== "test") {
      setPage("test");
    }
  }, [readOnly, page, setPage]);

  const update = useCallback((patch: Partial<APIData>) => {
    setAPI({ ...apiRef.current, ...patch });
  }, [setAPI]);

  return (
    <div className="panel is-clip">
      <div className="panel-box is-fill is-flush">
        <div className="api-swipe-root">
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div className="apitest-panel-wrapper">
                <APITest
                  api={api}
                  onUpdateApi={update}
                  initialExampleIndex={initialExampleIndex}
                  selector={readOnly ? selector : undefined}
                  rightOfUrlButton={
                    readOnly ? undefined : (
                      <>
                        <YamlErrorWarning />
                        <HeaderAction
                          icon="edit"
                          label="Edit API"
                          onClick={() => setPage('edit')}
                        />
                      </>
                    )
                  }
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              {page === 'edit' && (
                <React.Fragment key={mmtFilePath}>
                  <PanelEditHeader
                    title="Edit API"
                    onBack={() => setPage('test')}
                    backTitle="Back to Test"
                  />

                  <div className="panel-scroll">
                    <APIOverview api={api} update={update} />
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIs;
