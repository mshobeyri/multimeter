import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import EditableSelect from "./EditableSelect";
import SearchableTagInput from "./SearchableTagInput";
import ParameterEditor from "./ParameterEditor";
import InterfaceEditor, { InterfaceData } from "./InterfaceEditor";

export type Parameter = { [key: string]: string };

export interface APIField {
  type: string;
  title?: string;
  tags?: string[];
  description?: string;
  inputs?: Parameter[];
  outputs?: Parameter[];
  interfaces?: Array<InterfaceData>;
}

interface APIEditorProps {
  api: APIField;
  setAPI: (api: APIField) => void;
}

const APIEditor: React.FC<APIEditorProps> = ({ api, setAPI }) => {
  // Helper to update top-level fields
  const update = (patch: Partial<APIField>) => setAPI({ ...api, ...patch });

  // Helper to update inputs/outputs
  const updateArrayField = (
    field: "inputs" | "outputs",
    idx: number,
    key: string,
    value: string,
    isKey: boolean
  ) => {
    const arr = api[field] ? [...api[field]!] : [];
    const entry = arr[idx];
    const [oldKey] = Object.keys(entry);
    const oldValue = entry[oldKey];
    if (isKey) {
      arr[idx] = { [key]: oldValue };
    } else {
      arr[idx] = { [oldKey]: value };
    }
    update({ [field]: arr });
  };

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
      <table
        className="APIEditor"
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: "70%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ padding: "8px" }}>type</td>
            <td style={{ padding: "8px" }}>
              <ValidatableSelect
                value={api.type || ""}
                options={["api", "interface"]}
                onChange={val => update({ type: val })}
                showPlaceholder={true}
                placeholder="Select type..."
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px" }}>title</td>
            <td style={{ padding: "8px" }}>
              <input
                value={api.title || ""}
                onChange={e => update({ title: e.target.value })}
                placeholder="title"
                style={{ width: "100%" }}
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px" }}>tags</td>
            <td style={{ padding: "8px" }}>
              <SearchableTagInput
                tags={api.tags || []}
                onChange={tags => update({ tags })}
                suggestions={["security", "sessionless", "api", "user", "admin"]}
              />
            </td>
          </tr>
          <tr>
            <td style={{ padding: "8px" }}>description</td>
            <td style={{ padding: "8px" }}>
              <input
                value={api.description || ""}
                onChange={e => update({ description: e.target.value })}
                placeholder="description"
                style={{ width: "100%" }}
              />
            </td>
          </tr>

          {/* Inputs Section */}
          <tr>
            <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>input</td>
          </tr>
          {(api.inputs || []).map((input, i) => (
            <ParameterEditor
              key={i}
              parameter={input}
              onChange={newParam => {
                const newInputs = [...(api.inputs || [])];
                newInputs[i] = newParam;
                update({ inputs: newInputs });
              }}
              valueOptions={[]} // or provide suggestions
            />
          ))}

          {/* Outputs Section */}
          <tr>
            <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>output</td>
          </tr>
          {(api.outputs || []).map((output, i) => (
            <ParameterEditor
              key={i}
              parameter={output}
              onChange={newParam => {
                const newOutputs = [...(api.outputs || [])];
                newOutputs[i] = newParam;
                update({ outputs: newOutputs });
              }}
              valueOptions={[]} // or provide suggestions
            />
          ))}

          {/* Interfaces Section */}
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
                  />
                  <button
                    onClick={() => removeInterface(idx)}
                    style={{ marginTop: 8, color: "red" }}
                  >
                    Remove Interface
                  </button>
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
    </div>
  );
};

export default APIEditor;