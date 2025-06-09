import React from "react";
import FieldWithRemove from "./FieldWithRemove";

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
  onRemove?: () => void;
}

const protocolOptions: Protocol[] = ["http", "ws", "grpc"];
const formatOptions: Format[] = ["json", "xml", "protobuf"];

function renderKVEditor(
  label: string,
  value: Record<string, string> | undefined,
  onChange: (v: Record<string, string>) => void
) {
  return (
    <React.Fragment>
      <tr>
        <td style={{ padding: "8px", fontWeight: "bold", verticalAlign: "top" }}>{label}</td>
        <td style={{ padding: "8px" }}>
          <table style={{ width: "100%" }}>
            <tbody>
              {Object.entries(value || {}).map(([k, v], i) => (
                <tr key={i}>
                  <td style={{ width: "40%" }}>
                    <FieldWithRemove
                      value={k}
                      onChange={newKey => {
                        if (!newKey) return;
                        const newObj = { ...(value || {}) };
                        delete newObj[k];
                        newObj[newKey] = v;
                        onChange(newObj);
                      }}
                      onRemovePressed={() => {
                        const newObj = { ...(value || {}) };
                        delete newObj[k];
                        onChange(newObj);
                      }}
                      placeholder="key"
                    />
                  </td>
                  <td style={{ width: "60%" }}>
                    <FieldWithRemove
                      value={v}
                      onChange={newVal => {
                        onChange({ ...(value || {}), [k]: newVal });
                      }}
                      onRemovePressed={() => {
                        const newObj = { ...(value || {}) };
                        delete newObj[k];
                        onChange(newObj);
                      }}
                      placeholder="value"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <input
                    placeholder="key"
                    style={{ width: "90%" }}
                    value={""}
                    onChange={e => {
                      const newKey = e.target.value;
                      if (newKey) onChange({ ...(value || {}), [newKey]: "" });
                    }}
                  />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </React.Fragment>
  );
}

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange, onRemove }) => {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "30%" }} />
        <col style={{ width: "70%" }} />
      </colgroup>
      <tbody>
        <tr>
          <td style={{ padding: "8px", fontWeight: "bold" }}>Name</td>
          <td style={{ padding: "8px" }}>
            <FieldWithRemove
              value={data.name}
              onChange={v => onChange({ ...data, name: v })}
              onRemovePressed={onRemove ?? (() => {})}
              placeholder="name"
            />
          </td>
        </tr>
        <tr>
          <td style={{ padding: "8px", fontWeight: "bold" }}>Protocol</td>
          <td style={{ padding: "8px" }}>
            <select
              value={data.protocol}
              onChange={e => onChange({ ...data, protocol: e.target.value as Protocol })}
              style={{ width: "100%" }}
            >
              {protocolOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td style={{ padding: "8px", fontWeight: "bold" }}>Format</td>
          <td style={{ padding: "8px" }}>
            <select
              value={data.format}
              onChange={e => onChange({ ...data, format: e.target.value as Format })}
              style={{ width: "100%" }}
            >
              {formatOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td style={{ padding: "8px", fontWeight: "bold" }}>Endpoint</td>
          <td style={{ padding: "8px" }}>
            <input
              value={data.endpoint}
              onChange={e => onChange({ ...data, endpoint: e.target.value })}
              style={{ width: "100%" }}
            />
          </td>
        </tr>
        {renderKVEditor("Headers", data.headers, headers => onChange({ ...data, headers }))}
        {renderKVEditor("Query", data.query, query => onChange({ ...data, query }))}
        {renderKVEditor("Params", data.params, params => onChange({ ...data, params }))}
        {renderKVEditor("Cookies", data.cookies, cookies => onChange({ ...data, cookies }))}
        <tr>
          <td style={{ padding: "8px", fontWeight: "bold", verticalAlign: "top" }}>Body</td>
          <td style={{ padding: "8px" }}>
            <textarea
              value={data.body || ""}
              onChange={e => onChange({ ...data, body: e.target.value })}
              style={{ width: "100%", minHeight: 60 }}
            />
          </td>
        </tr>
        {/* Outputs editing can be added similarly if needed */}
      </tbody>
    </table>
  );
};

export default InterfaceEditor;