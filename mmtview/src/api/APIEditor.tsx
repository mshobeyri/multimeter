import React, { useEffect, useState } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./APIInterface";
import ExampleEditor from "./APIExample";
import APITest from "./APITest";
import { APIData, InterfaceData, ExampleData } from "./APIData";

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
    const interfaces = api.interfaces ? [...api.interfaces] : [];
    interfaces[idx] = { ...interfaces[idx], ...patch };
    setAPI({ ...api, interfaces });
  };

  // Helper to remove an interface
  const removeInterface = (idx: number) => {
    const interfaces = (api.interfaces || []).filter((_, i) => i !== idx);
    setAPI({ ...api, interfaces });
  };

  // Helper to add a new interface
  const addInterface = () => {
    const interfaces = api.interfaces ? [...api.interfaces] : [];
    interfaces.push({
      name: "",
      protocol: "http",
      format: "json",
      url: "",
    });
    setAPI({ ...api, interfaces });
  };

  const updateExample = (idx: number, patch: Partial<ExampleData>) => {
    const examples = api.examples ? [...api.examples] : [];
    examples[idx] = { ...examples[idx], ...patch };
    setAPI({ ...api, examples });
  };

  const removeExample = (idx: number) => {
    const examples = (api.examples || []).filter((_, i) => i !== idx);
    setAPI({ ...api, examples });
  };

  const addExample = () => {
    const examples = api.examples ? [...api.examples] : [];
    examples.push({
      name: "",
    });
    setAPI({ ...api, examples });
  };

  return (
    <div
      style={{
        position: "relative",
        background: "var(--vscode-editorWidget-background, #232323)",
        border: "1px solid var(--vscode-editorWidget-border, #333)",
        borderRadius: "6px",
        padding: "16px",
        minWidth: 200,
        marginBottom: "16px"
      }}
    >
      {/* Tab Bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}>
        <button
          onClick={() => setTab("overview")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "overview" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "overview" ? "bold" : "normal",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span className="codicon codicon-search" style={{ fontSize: "16px" }}></span>
          Overview
        </button>
        <button
          onClick={() => setTab("interfaces")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "interfaces" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "interfaces" ? "bold" : "normal",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span className="codicon codicon-symbol-interface" style={{ fontSize: "16px" }}></span>
          Interfaces
        </button>
        <button
          onClick={() => setTab("examples")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "examples" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "examples" ? "bold" : "normal",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span className="codicon codicon-lightbulb" style={{ fontSize: "16px" }}></span>
          Examples
        </button>
        <button
          onClick={() => setTab("test")}
          style={{
            padding: "8px 24px",
            border: "none",
            borderBottom: tab === "test" ? "2px solid #0e639c" : "2px solid transparent",
            background: "none",
            color: "inherit",
            fontWeight: tab === "test" ? "bold" : "normal",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span className="codicon codicon-play" style={{ fontSize: "16px" }}></span>
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
                {(api.interfaces || []).map((iface, idx) => (
                  <div key={idx} style={{
                    marginBottom: "16px",
                    position: "relative",
                    padding: "16px",
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "2px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: 6,
                    color: "var(--vscode-editor-foreground, #fff)",
                    userSelect: "none",
                    transition: "background 0.35s",
                  }}>
                    <InterfaceEditor
                      data={iface}
                      onChange={updated => updateInterface(idx, updated)}
                      onRemove={() => removeInterface(idx)}
                    />
                  </div>
                ))}
                <button
                  onClick={addInterface}
                  style={{
                    width: "100%",
                    background: "var(--vscode-button-background, #0e639c)",
                    color: "var(--vscode-button-foreground, #fff)",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 16px",
                    cursor: "pointer"
                  }}
                >
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
                {(api.examples || []).map((example, idx) => (
                  <div key={idx} style={{
                    marginBottom: "16px",
                    position: "relative",
                    padding: "16px",
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "2px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: 6,
                    color: "var(--vscode-editor-foreground, #fff)",
                    userSelect: "none",
                    transition: "background 0.35s",
                  }}>
                    <ExampleEditor
                      data={example}
                      apiInputs={
                        api.inputs
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
                <button
                  onClick={addExample}
                  style={{
                    width: "100%",
                    background: "var(--vscode-button-background, #0e639c)",
                    color: "var(--vscode-button-foreground, #fff)",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 16px",
                    cursor: "pointer"
                  }}
                >
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