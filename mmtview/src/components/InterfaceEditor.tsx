import React, { useCallback } from "react";
import FieldWithRemove from "./FieldWithRemove";
import KVEditor from "./KVEditor";
import { Format, Protocol, InterfaceData } from "./APIData";

interface InterfaceEditorProps {
  data: InterfaceData;
  onChange: (data: InterfaceData) => void;
  onRemove?: () => void;
}

const protocolOptions: Protocol[] = ["http", "ws", "grpc"];
const formatOptions: Format[] = ["json", "xml", "protobuf"];

function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!qs) return result;
  // Remove leading "?" if present
  const clean = qs.startsWith("?") ? qs.slice(1) : qs;
  for (const pair of clean.split("&")) {
    if (!pair) continue;
    const [k, v] = pair.split("=");
    if (k) result[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  }
  return result;
}

function buildQueryString(params: Record<string, string> = {}) {
  const entries = Object.entries(params).filter(([k, v]) => k);
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`
      )
      .join("&")
  );
}

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange, onRemove }) => {
  // Split endpoint and query string
  const endpoint = data.endpoint.split("?")[0];
  const endpointQuery = data.endpoint.includes("?") ? data.endpoint.slice(data.endpoint.indexOf("?")) : "";
  const queryString = buildQueryString(data.query);

  // Keep endpoint and query params in sync
  const handleEndpointChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const [base, ...queryParts] = value.split("?");
      const queryStr = queryParts.join("?");
      const query = parseQueryString(queryStr);
      onChange({
        ...data,
        endpoint: base + (queryStr ? "?" + queryStr : ""),
        query,
      });
    },
    [data, onChange]
  );

  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      const qs = buildQueryString(query);
      onChange({
        ...data,
        endpoint: endpoint + qs,
        query,
      });
    },
    [data, onChange, endpoint]
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "80%" }} />
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
              value={endpoint + queryString}
              onChange={handleEndpointChange}
              style={{ width: "100%" }}
            />
          </td>
        </tr>
        <KVEditor
          label="QueryParams"
          value={data.query}
          onChange={handleQueryChange}
        />
        <KVEditor label="Headers" value={data.headers} onChange={headers => onChange({ ...data, headers })} />
        <KVEditor label="Cookies" value={data.cookies} onChange={cookies => onChange({ ...data, cookies })} />
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