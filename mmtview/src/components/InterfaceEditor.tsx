import React, { useCallback } from "react";
import FieldWithRemove from "./FieldWithRemove";
import KVEditor from "./KVEditor";
import EndpointInput from "./EndpointInput";
import { Format, Protocol, InterfaceData } from "./APIData";

interface InterfaceEditorProps {
  data: InterfaceData;
  onChange: (data: InterfaceData) => void;
  onRemove?: () => void;
}

const protocolOptions: Protocol[] = ["http", "ws", "grpc"];
const formatOptions: Format[] = ["json", "xml", "protobuf"];

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange, onRemove }) => {
  // Split endpoint and query string
  const endpoint = data.endpoint.split("?")[0];

  // When EndpointInput changes, update only the endpoint part in YAML/model
  const handleEndpointChange = useCallback(
    (newEndpoint: string) => {
      onChange({
        ...data,
        endpoint: newEndpoint,
      });
    },
    [data, onChange]
  );

  // When QueryParams change, update only the query part in YAML/model
  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      onChange({
        ...data,
        query,
      });
    },
    [data, onChange]
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
            <EndpointInput
              endpoint={endpoint}
              query={data.query || {}}
              onEndpointChange={handleEndpointChange}
              onQueryChange={handleQueryChange}
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