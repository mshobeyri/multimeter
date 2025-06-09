import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import EditableSelect from "./EditableSelect";
import SearchableTagInput from "./SearchableTagInput";

export interface APIField {
  type: string;
  title: string;
  tags: string[];
  description?: string;
  inputs?: Array<Record<string, string>>;
  outputs?: Array<Record<string, string>>;
  interfaces?: Array<{
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
  }>;
};

interface APIFieldEditorProps {
  api: APIField;
  onChange: (api: APIField) => void;
}

const protocolOptions = ["http", "grpc"];
const formatOptions = ["json", "xml", "protobuf"];

const APIFieldEditor: React.FC<APIFieldEditorProps> = ({ api, onChange }) => {
  // Helper to update top-level fields
  const update = (patch: Partial<APIField>) => onChange({ ...api, ...patch });

  // Helper to update interfaces
  type APIInterface = NonNullable<APIField["interfaces"]>[number];
  const updateInterface = (idx: number, patch: Partial<APIInterface>) => {
    const interfaces = api.interfaces ? [...api.interfaces] : [];
    interfaces[idx] = { ...interfaces[idx], ...patch };
    update({ interfaces });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label>
        <b>Type:</b>
        <input
          value={api.type}
          onChange={e => update({ type: e.target.value })}
          style={{ marginLeft: 8, width: 180 }}
        />
      </label>
      <label>
        <b>Title:</b>
        <input
          value={api.title}
          onChange={e => update({ title: e.target.value })}
          style={{ marginLeft: 8, width: 300 }}
        />
      </label>
      <label>
        <b>Description:</b>
        <input
          value={api.description || ""}
          onChange={e => update({ description: e.target.value })}
          style={{ marginLeft: 8, width: 400 }}
        />
      </label>
      <label>
        <b>Tags:</b>
        <SearchableTagInput
          tags={api.tags || []}
          onChange={tags => update({ tags })}
          suggestions={["security", "sessionless", "api", "user", "admin"]}
        />
      </label>
      <div>
        <b>Inputs:</b>
        <table>
          <tbody>
            {(api.inputs || []).map((input, i) => {
              const [k, v] = Object.entries(input)[0];
              return (
                <tr key={i}>
                  <td>
                    <input
                      value={k}
                      onChange={e => {
                        const newInputs = [...(api.inputs || [])];
                        const val = newInputs[i][k];
                        delete newInputs[i][k];
                        newInputs[i][e.target.value] = val;
                        update({ inputs: newInputs });
                      }}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <input
                      value={v}
                      onChange={e => {
                        const newInputs = [...(api.inputs || [])];
                        newInputs[i][k] = e.target.value;
                        update({ inputs: newInputs });
                      }}
                      style={{ width: 180 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <b>Outputs:</b>
        <table>
          <tbody>
            {(api.outputs || []).map((output, i) => {
              const [k, v] = Object.entries(output)[0];
              return (
                <tr key={i}>
                  <td>
                    <input
                      value={k}
                      onChange={e => {
                        const newOutputs = [...(api.outputs || [])];
                        const val = newOutputs[i][k];
                        delete newOutputs[i][k];
                        newOutputs[i][e.target.value] = val;
                        update({ outputs: newOutputs });
                      }}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <input
                      value={v}
                      onChange={e => {
                        const newOutputs = [...(api.outputs || [])];
                        newOutputs[i][k] = e.target.value;
                        update({ outputs: newOutputs });
                      }}
                      style={{ width: 180 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <b>Interfaces:</b>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Protocol</th>
              <th>Format</th>
              <th>Endpoint</th>
            </tr>
          </thead>
          <tbody>
            {(api.interfaces || []).map((iface, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={iface.name}
                    onChange={e => updateInterface(i, { name: e.target.value })}
                    style={{ width: 100 }}
                  />
                </td>
                <td>
                  <EditableSelect
                    value={iface.protocol}
                    options={protocolOptions}
                    onChange={val => updateInterface(i, { protocol: val })}
                  />
                </td>
                <td>
                  <EditableSelect
                    value={iface.format}
                    options={formatOptions}
                    onChange={val => updateInterface(i, { format: val })}
                  />
                </td>
                <td>
                  <input
                    value={iface.endpoint}
                    onChange={e => updateInterface(i, { endpoint: e.target.value })}
                    style={{ width: 180 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default APIFieldEditor;