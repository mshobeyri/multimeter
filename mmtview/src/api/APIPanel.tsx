import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useEffect, useState, useRef } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import APIExample from "./APIExample";
import APITest from "./APITester";
import { APIData, ExampleData } from "mmt-core/APIData";
import { safeList, safeListCopy } from "mmt-core/safer";

const LAST_API_TAB_KEY = "mmtview:api:lastTab";
const LAST_API_PAGE_KEY = "mmtview:api:lastPage";

interface APIsProps {
  content: string;
  setContent: (value: string) => void;
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  const api = yamlToAPI(content);
  let setAPI = (newApi: APIData) => {
    const newYaml = apiToYaml(newApi);
    setContent(newYaml);
  };

  const [page, setPage] = useState<"test" | "edit">(
    () => (localStorage.getItem(LAST_API_PAGE_KEY) as "test" | "edit") || "test"
  );
  const [tab, setTab] = useState<"overview" | "interface" | "examples">(
    () => (localStorage.getItem(LAST_API_TAB_KEY) as "overview" | "interface" | "examples") || "overview"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LAST_API_PAGE_KEY, page);
  }, [page]);

  useEffect(() => {
    localStorage.setItem(LAST_API_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    const checkTabWidth = () => {
      if (!tabContainerRef.current) return;

      const container = tabContainerRef.current;
      const containerWidth = container.clientWidth;

      const fullTextWidth = 4 * 100;

      setShowIconsOnly(containerWidth < fullTextWidth);
    };

    checkTabWidth();

    const resizeObserver = new ResizeObserver(checkTabWidth);
    if (tabContainerRef.current) {
      resizeObserver.observe(tabContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Helper to update top-level fields
  const update = (patch: Partial<APIData>) => {
    setAPI({ ...api, ...patch });
  };

  // Helper to update a specific interface
  const updateInterface = (patch: Partial<APIData>) => {
    setAPI({ ...api, ...patch });
  };

  const updateExample = (idx: number, patch: Partial<ExampleData>) => {
    setAPI({ ...api, examples: safeListCopy(api.examples).map((example, i) => i === idx ? { ...example, ...patch } : example) });
  };

  const removeExample = (idx: number) => {

    const examples = safeList(api.examples).filter((_, i) => i !== idx);
    setAPI({ ...api, examples });
  };

  const addExample = () => {

    const examples = safeListCopy(api.examples);
    examples.push({ name: "" });
    setAPI({ ...api, examples });
  };

  const isTestPage = page === "test";

  return (
    <div className="panel" style={{ minHeight: 600, overflow: 'hidden' }}>
      <div
        className="panel-box"
        style={isTestPage ? { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, marginBottom: 0 } : undefined}
      >
        <div className="api-swipe-root" style={{ flex: 1, minHeight: 0 }}>
          <div
            className="api-swipe-track"
            style={{ transform: page === 'test' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="api-swipe-page api-swipe-page--test">
              <div className="apitest-panel-wrapper">
                <APITest
                  api={api}
                  onUpdateApi={update}
                  rightOfUrlButton={
                    <button
                      className="action-button"
                      onClick={() => setPage('edit')}
                      title="Edit API"
                      type="button"
                    >
                      <span className="codicon codicon-edit" aria-hidden />
                        <span className="api-edit-launcher-text">Edit API</span>
                    </button>
                  }
                />
              </div>
            </div>

            <div className="api-swipe-page api-swipe-page--edit">
              <div className="api-edit-header">
                <div className="api-edit-header-row">
                  <button
                    className="action-button"
                    onClick={() => setPage('test')}
                    title="Back to Test"
                    type="button"
                  >
                    <span className="codicon codicon-arrow-left" aria-hidden />
                  </button>
                  <div className="api-edit-title">Edit API</div>
                </div>
                <div ref={tabContainerRef} className="tab-bar">
                  <button
                    onClick={() => setTab('overview')}
                    className={`tab-button ${tab === 'overview' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Overview' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-search tab-button-icon"></span>
                    {!showIconsOnly && 'Overview'}
                  </button>
                  <button
                    onClick={() => setTab('interface')}
                    className={`tab-button ${tab === 'interface' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Interface' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-symbol-interface tab-button-icon"></span>
                    {!showIconsOnly && 'Interface'}
                  </button>
                  <button
                    onClick={() => setTab('examples')}
                    className={`tab-button ${tab === 'examples' ? 'active' : ''}`}
                    title={showIconsOnly ? 'Examples' : undefined}
                    type="button"
                  >
                    <span className="codicon codicon-lightbulb tab-button-icon"></span>
                    {!showIconsOnly && 'Examples'}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {tab === 'overview' && <APIOverview api={api} update={update} />}

                {tab === 'interface' && (
                  <InterfaceEditor
                    data={api}
                    onChange={(updated) => updateInterface(updated)}
                  />
                )}

                {tab === 'examples' && (
                  <table
                    className="APIEditor"
                    style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 0 }}
                  >
                    <tbody>
                      <tr>
                        <td colSpan={2} style={{ padding: 0 }}>
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
                          <button onClick={addExample} className="button-icon" type="button">
                            <span className="codicon codicon-add" aria-hidden />
                            Add Example
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIs;