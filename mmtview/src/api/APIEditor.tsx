import React, { useEffect, useState } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import ExampleEditor from "./APIExample";
import APITest from "./APITest";
import { APIData, InterfaceData, ExampleData } from "./APIData";
import { isList, safeList, safeListCopy } from "../safer";

const LAST_API_TAB_KEY = "mmtview:api:lastTab";

interface APIEditorProps {
  api: APIData;
  setAPI: (api: APIData) => void;
}

const APIEditor: React.FC<APIEditorProps> = ({ api, setAPI }) => {
  // Restore last selected tab from localStorage, default to "test"
  const [tab, setTab] = useState<"overview" | "interfaces" | "examples" | "test">(
    () => (localStorage.getItem(LAST_API_TAB_KEY) as "overview" | "interfaces" | "examples" | "test") || "test"
  );

  useEffect(() => {
    localStorage.setItem(LAST_API_TAB_KEY, tab);
  }, [tab]);

  // Helper to update top-level fields
  const update = (patch: Partial<APIData>) => setAPI({ ...api, ...patch });

  // Helper to update a specific interface
  const updateInterface = (idx: number, patch: Partial<InterfaceData>) => {
    const interfaces = safeListCopy(api.interfaces);
    interfaces[idx] = { ...interfaces[idx], ...patch };
    setAPI({ ...api, interfaces });
  };

  // Helper to remove an interface
  const removeInterface = (idx: number) => {
    const interfaces = safeList(api.interfaces).filter((_, i) => i !== idx);
    setAPI({ ...api, interfaces });
  };

  // Helper to add a new interface
  const addInterface = () => {
    const interfaces = safeListCopy(api.interfaces);
    interfaces.push({
      name: "",
      protocol: "http",
      format: "json",
      url: "",
    });
    setAPI({ ...api, interfaces });
  };

  const updateExample = (idx: number, patch: Partial<ExampleData>) => {
    const examples = safeListCopy(api.examples);
    examples[idx] = { ...examples[idx], ...patch };
    setAPI({ ...api, examples });
  };

  const removeExample = (idx: number) => {
    const examples = safeList(api.examples).filter((_, i) => i !== idx);
    setAPI({ ...api, examples });
  };

  const addExample = () => {
    const examples = safeListCopy(api.examples);
    examples.push({
      name: "",
    });
    setAPI({ ...api, examples });
  };

  return (
    <div className="panel-box">
      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}>
        <button
          onClick={() => setTab("overview")}
          className={`tab-button ${tab === "overview" ? "active" : ""}`}
        >
          <span className="codicon codicon-search tab-button-icon"></span>
          Overview
        </button>
        <button
          onClick={() => setTab("interfaces")}
          className={`tab-button ${tab === "interfaces" ? "active" : ""}`}
        >
          <span className="codicon codicon-symbol-interface tab-button-icon"></span>
          Interfaces
        </button>
        <button
          onClick={() => setTab("examples")}
          className={`tab-button ${tab === "examples" ? "active" : ""}`}
        >
          <span className="codicon codicon-lightbulb tab-button-icon"></span>
          Examples
        </button>
        <button
          onClick={() => setTab("test")}
          className={`tab-button ${tab === "test" ? "active" : ""}`}
        >
          <span className="codicon codicon-play tab-button-icon"></span>
          Test
        </button>
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <APIOverview api={api} update={update} />
      )}

      {tab === "interfaces" && (
        <table
          className="APIEditor"
          style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginTop: 0 }}
        >
          <tbody>
            <tr>
              <td colSpan={2} style={{ padding: 0 }}>
                {safeList(api.interfaces).map((iface, idx) => (
                  <div key={idx} className="inner-box">
                    <InterfaceEditor
                      data={iface}
                      onChange={updated => updateInterface(idx, updated)}
                      onRemove={() => removeInterface(idx)}
                    />
                  </div>
                ))}
                <button className="add-button" onClick={addInterface}>
                  Add Interface
                </button>
              </td>
            </tr>
          </tbody>
        </table>
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
                    <ExampleEditor
                      data={example}
                      apiInputs={
                        isList(api.inputs)
                          ? Object.fromEntries(
                            api.inputs.map(query =>
                              query && typeof query === "object"
                                ? query.name
                                  ? [query.name, query.type]
                                  : [Object.keys(query)[0], Object.values(query)[0]]
                                : []
                            )
                          )
                          : undefined
                      }
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
        <APITest api={api} />
      )}
    </div>
  );
};

export default APIEditor;