import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import EditableSelect from "./EditableSelect";
import SearchableTagInput from "./SearchableTagInput";

export interface APIInterface {
  name: string;
  protocol: string;
  format: string;
  endpoint: string;
  headers?: Record<string, string>;
  body?: string;
  outputs?: Record<
    string,
    | string
    | { [format: string]: string }
  >;
}

export interface APIField {
  type: string;
  title?: string;
  tags?: string[];
  description?: string;
  inputs?: Array<Record<string, string>>;
  outputs?: Array<Record<string, string>>;
  interfaces?: Array<APIInterface>;
}

interface APIEditorProps {
  api: APIField;
  setAPI: (api: APIField) => void;
}

const protocolOptions = ["http", "grpc"];
const formatOptions = ["json", "xml", "protobuf"];

const APIEditor: React.FC<APIEditorProps> = ({ api, setAPI }) => {
  // Helper to update top-level fields
  const update = (patch: Partial<APIField>) => setAPI({ ...api, ...patch });

  // Helper to update interfaces
  const updateInterface = (idx: number, patch: Partial<APIInterface>) => {
    const interfaces = api.interfaces ? [...api.interfaces] : [];
    interfaces[idx] = { ...interfaces[idx], ...patch };
    update({ interfaces });
  };

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
          {(api.inputs || []).map((input, i) => {
            const [k, v] = Object.entries(input)[0];
            return (
              <tr key={i}>
                <td style={{ padding: "8px", textAlign: "right", width: "40%" }}>
                  <input
                    value={k}
                    onChange={e => updateArrayField("inputs", i, e.target.value, v, true)}
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ padding: "8px", width: "60%" }}>
                  <input
                    value={v}
                    onChange={e => updateArrayField("inputs", i, k, e.target.value, false)}
                    style={{ width: "100%" }}
                  />
                </td>
              </tr>
            );
          })}

          {/* Outputs Section */}
          <tr>
            <td colSpan={2} style={{ padding: "8px", fontWeight: "bold" }}>output</td>
          </tr>
          {(api.outputs || []).map((output, i) => {
            const [k, v] = Object.entries(output)[0];
            return (
              <tr key={i}>
                <td style={{ padding: "8px", textAlign: "right", width: "40%" }}>
                  <input
                    value={k}
                    onChange={e => updateArrayField("outputs", i, e.target.value, v, true)}
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ padding: "8px", width: "60%" }}>
                  <input
                    value={v}
                    onChange={e => updateArrayField("outputs", i, k, e.target.value, false)}
                    style={{ width: "100%" }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default APIEditor;