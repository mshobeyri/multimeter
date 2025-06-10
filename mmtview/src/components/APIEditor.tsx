import React, { useState } from "react";
import APIOverview from "./APIOverview";
import InterfaceEditor from "./InterfaceEditor";
import { APIData, InterfaceData } from "./APIData";

interface APIEditorProps {
  api: APIData;
  setAPI: (api: APIData) => void;
}

const APIEditor: React.FC<APIEditorProps> = ({ api, setAPI }) => {
  const [tab, setTab] = useState<"overview" | "interfaces" | "test">("test");

  // Helper to update top-level fields
  const update = (patch: Partial<APIData>) => setAPI({ ...api, ...patch });

  // Helper to update a specific interface
  const updateInterface = (idx: number, patch: Partial<InterfaceData>) => {
    console.log("Updating interface at index", idx, "with patch", patch);
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
      endpoint: "",
    });
    setAPI({ ...api, interfaces });
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
            cursor: "pointer"
          }}
        >
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
            cursor: "pointer"
          }}
        >
          Interfaces
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
            cursor: "pointer"
          }}
        >
          <span role="img" aria-label="run">▶️</span> Test
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
              <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>interfaces</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: 0 }}>
                {(api.interfaces || []).map((iface, idx) => (
                  <div key={idx} style={{ marginBottom: 16, border: "1px solid #444", borderRadius: 4, padding: 8 }}>
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
                    marginTop: 8,
                    background: "var(--vscode-button-background, #0e639c)",
                    color: "var(--vscode-button-foreground, #fff)",
                    border: "none",
                    borderRadius: 4,
                    padding: "8px 16px",
                    fontWeight: "bold",
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

      {tab === "test" && (
        <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
          {/* Test tab content goes here */}
        </div>
      )}
    </div>
  );
};

export default APIEditor;