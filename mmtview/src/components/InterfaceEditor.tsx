import React from "react";

export type Protocol = "http" | "ws" | "grpc";
export type Format = "json" | "xml" | "protobuf";

export interface InterfaceData {
  name: string;
  protocol: Protocol;
  format: Format;
  endpoint: string;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  cookies?: Record<string, string>;
  outputs?: Record<string, string | { [format: string]: string }>;
}

interface InterfaceEditorProps {
  data: InterfaceData;
  onChange: (data: InterfaceData) => void;
}

const protocolOptions: Protocol[] = ["http", "ws", "grpc"];
const formatOptions: Format[] = ["json", "xml", "protobuf"];

function renderKVEditor(
  label: string,
  value: Record<string, string> | undefined,
  onChange: (v: Record<string, string>) => void
) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontWeight: "bold" }}>{label}</label>
      <table style={{ width: "100%", marginTop: 4 }}>
        <tbody>
          {Object.entries(value || {}).map(([k, v], i) => (
            <tr key={i}>
              <td>
                <input
                  value={k}
                  onChange={e => {
                    const newKey = e.target.value;
                    const newObj = { ...(value || {}) };
                    delete newObj[k];
                    newObj[newKey] = v;
                    onChange(newObj);
                  }}
                  placeholder="key"
                  style={{ width: 100 }}
                />
              </td>
              <td>
                <input
                  value={v}
                  onChange={e => {
                    onChange({ ...(value || {}), [k]: e.target.value });
                  }}
                  placeholder="value"
                  style={{ width: 180 }}
                />
              </td>
              <td>
                <button
                  onClick={() => {
                    const newObj = { ...(value || {}) };
                    delete newObj[k];
                    onChange(newObj);
                  }}
                  style={{ marginLeft: 8 }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                placeholder="key"
                style={{ width: 100 }}
                value={""}
                onChange={e => {
                  const newKey = e.target.value;
                  if (newKey) onChange({ ...(value || {}), [newKey]: "" });
                }}
              />
            </td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange }) => {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: "bold" }}>Name</label>
        <input
          value={data.name}
          onChange={e => onChange({ ...data, name: e.target.value })}
          style={{ marginLeft: 8, width: 200 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: "bold" }}>Protocol</label>
        <select
          value={data.protocol}
          onChange={e => onChange({ ...data, protocol: e.target.value as Protocol })}
          style={{ marginLeft: 8 }}
        >
          {protocolOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: "bold" }}>Format</label>
        <select
          value={data.format}
          onChange={e => onChange({ ...data, format: e.target.value as Format })}
          style={{ marginLeft: 8 }}
        >
          {formatOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: "bold" }}>Endpoint</label>
        <input
          value={data.endpoint}
          onChange={e => onChange({ ...data, endpoint: e.target.value })}
          style={{ marginLeft: 8, width: 300 }}
        />
      </div>
      {renderKVEditor("Headers", data.headers, headers => onChange({ ...data, headers }))}
      {renderKVEditor("Query", data.query, query => onChange({ ...data, query }))}
      {renderKVEditor("Params", data.params, params => onChange({ ...data, params }))}
      {renderKVEditor("Cookies", data.cookies, cookies => onChange({ ...data, cookies }))}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: "bold" }}>Body</label>
        <textarea
          value={data.body || ""}
          onChange={e => onChange({ ...data, body: e.target.value })}
          style={{ display: "block", width: "100%", minHeight: 60, marginTop: 4 }}
        />
      </div>
      {/* Outputs editing can be added similarly if needed */}
    </div>
  );
};

export default InterfaceEditor;