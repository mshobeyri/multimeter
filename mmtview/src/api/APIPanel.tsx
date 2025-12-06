import { yamlToAPI, apiToYaml } from "mmt-core/apiParsePack";
import React, { useEffect, useState, useRef } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import APIExample from "./APIExample";
import APITest from "./APITester";
import { APIData, ExampleData } from "mmt-core/APIData";
import { safeList, safeListCopy } from "mmt-core/safer";

const LAST_API_TAB_KEY = "mmtview:api:lastTab";

interface APIsProps {
  content: string;
  setContent: (value: string) => void;
}

const APIs: React.FC<APIsProps> = ({ content, setContent }) => {
  const [api, setAPI] = useState<APIData>(yamlToAPI(content));

  // Parse YAML to api when content changes (but not if we just updated content from UI)
  useEffect(() => {
    const newApi = yamlToAPI(content);
    if (newApi === api || newApi === {} as APIData) return;
    setAPI(newApi);
  }, [content]);

  // Update YAML when api change (but not if we just updated api from YAML)
  useEffect(() => {
    const newYaml = apiToYaml(api);
    if (newYaml === content || newYaml === "") {
      return;
    }
    setContent(newYaml);
  }, [api]);

  const [tab, setTab] = useState<"overview" | "interface" | "examples" | "test">(
    () => (localStorage.getItem(LAST_API_TAB_KEY) as "overview" | "interface" | "examples" | "test") || "test"
  );
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const tabContainerRef = useRef<HTMLDivElement>(null);

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
    setAPI(prev => ({ ...prev, ...patch }));
  };

  // Helper to update a specific interface
  const updateInterface = (patch: Partial<APIData>) => {
    setAPI(prev => ({ ...prev, ...patch }));
  };

  const updateExample = (idx: number, patch: Partial<ExampleData>) => {
    setAPI(prev => {
      const examples = safeListCopy(prev.examples);
      examples[idx] = { ...examples[idx], ...patch };
      return { ...prev, examples };
    });
  };

  const removeExample = (idx: number) => {
    setAPI(prev => {
      const examples = safeList(prev.examples).filter((_, i) => i !== idx);
      return { ...prev, examples };
    });
  };

  const addExample = () => {
    setAPI(prev => {
      const examples = safeListCopy(prev.examples);
      examples.push({ name: "" });
      return { ...prev, examples };
    });
  };


  return (
    <div className="panel">
      <div className="panel-box">
        <div
          ref={tabContainerRef}
          className="tab-bar"
        >
          <button
            onClick={() => setTab("overview")}
            className={`tab-button ${tab === "overview" ? "active" : ""}`}
            title={showIconsOnly ? "Overview" : undefined}
          >
            <span className="codicon codicon-search tab-button-icon"></span>
            {!showIconsOnly && "Overview"}
          </button>
          <button
            onClick={() => setTab("interface")}
            className={`tab-button ${tab === "interface" ? "active" : ""}`}
            title={showIconsOnly ? "Interface" : undefined}
          >
            <span className="codicon codicon-symbol-interface tab-button-icon"></span>
            {!showIconsOnly && "Interface"}
          </button>
          <button
            onClick={() => setTab("examples")}
            className={`tab-button ${tab === "examples" ? "active" : ""}`}
            title={showIconsOnly ? "Examples" : undefined}
          >
            <span className="codicon codicon-lightbulb tab-button-icon"></span>
            {!showIconsOnly && "Examples"}
          </button>
          <button
            onClick={() => setTab("test")}
            className={`tab-button ${tab === "test" ? "active" : ""}`}
            title={showIconsOnly ? "Test" : undefined}
          >
            <span className="codicon codicon-play tab-button-icon"></span>
            {!showIconsOnly && "Test"}
          </button>
        </div>

        {tab === "overview" && (
          <APIOverview api={api} update={update} />
        )}

        {tab === "interface" && (
          <InterfaceEditor
            data={api}
            onChange={updated => updateInterface(updated)}
          />
        )}

        {tab === "examples" && (
          <table
            className="APIEditor"
            style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 0 }}
          >
            <tbody>
              <tr>
                <td colSpan={2} style={{ padding: 0 }}>
                  {safeList(api.examples).map((example, idx) => (
                    <div key={idx} className="inner-box">
                      <APIExample
                        data={example}
                        apiInputs={api.inputs}
                        apiOutputs={api.outputs}
                        onChange={updated => updateExample(idx, updated)}
                        onRemove={() => removeExample(idx)}
                      />
                    </div>
                  ))}
                  <button onClick={addExample} className="add-button">
                    Add Example
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === "test" && (
          <APITest api={api} onUpdateApi={update} />
        )}
      </div>
    </div>
  );
};

export default APIs;