import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import APIOverview from "./APIOverview";
import APIExample from "./APIExample";
import APITest from "./APITester";
import YamlErrorWarning from "./YamlErrorWarning";
import { APIData, ExampleData } from "mmt-core/APIData";
import { safeList, safeListCopy } from "mmt-core/safer";
import { useResolvedYamlContent } from "../useResolvedYamlContent";
import { usePanelPage } from "../usePanelPage";
import { FileContext } from "../fileContext";
import TabBar from "../components/TabBar";
import PrimaryButton from "../components/PrimaryButton";
import PanelEditHeader from "../components/PanelEditHeader";
import { HeaderAction } from "../components/PanelRunHeader";

const API_EDIT_TABS = [
  { id: "overview" as const, label: "Overview", icon: "search" },
  { id: "examples" as const, label: "Examples", icon: "lightbulb" },
];

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
  const [tab, setTab] = useState<"overview" | "examples">("overview");
  const { mmtFilePath } = useContext(FileContext);

  useEffect(() => {
    setTab("overview");
  }, [mmtFilePath]);

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

  const updateExample = useCallback((idx: number, patch: Partial<ExampleData>) => {
    setAPI({
      ...apiRef.current,
      examples: safeListCopy(apiRef.current.examples).map((example, i) =>
        i === idx ? { ...example, ...patch } : example
      ),
    });
  }, [setAPI]);

  const removeExample = useCallback((idx: number) => {
    const examples = safeList(apiRef.current.examples).filter((_, i) => i !== idx);
    setAPI({ ...apiRef.current, examples });
  }, [setAPI]);

  const addExample = useCallback(() => {
    const examples = safeListCopy(apiRef.current.examples);
    examples.push({ id: "" });
    setAPI({ ...apiRef.current, examples });
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
                  >
                    <TabBar tabs={API_EDIT_TABS} value={tab} onChange={setTab} />
                  </PanelEditHeader>

                  <div className="panel-scroll">
                    {tab === 'overview' && <APIOverview api={api} update={update} />}

                    {tab === 'examples' && (
                      <table className="field-table is-flush">
                        <tbody>
                          <tr>
                            <td colSpan={2}>
                              {safeList(api.examples)
                                .filter((ex) => ex != null)
                                .map((example, idx) => (
                                  <div key={idx} className="inner-box">
                                    <APIExample
                                      data={example}
                                      apiInputs={api.inputs}
                                      apiOutputs={api.outputs}
                                      onChange={(updated) => updateExample(idx, updated)}
                                      onRemove={() => removeExample(idx)}
                                    />
                                  </div>
                                ))}
                              <PrimaryButton icon="add" onClick={addExample}>
                                Add Example
                              </PrimaryButton>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
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
