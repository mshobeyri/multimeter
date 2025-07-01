import React, { useCallback, useRef, useEffect, useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import KVEditor from "../components/KVEditor";
import EndpointInput from "../components/EndpointInput";
import { Format, Protocol, InterfaceData, Method } from "../api/APIData";
import { formatBody, formattedBodyToYamlObject } from "../markupConvertor";
import BodyView from "../components/BodyView";

interface InterfaceEditorProps {
  data: InterfaceData;
  onChange: (data: InterfaceData) => void;
  onRemove?: () => void;
}

const protocolOptions: Protocol[] = ["http", "ws"];
const formatOptions: Format[] = ["json", "xml"];
const methodOptions: Method[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange, onRemove }) => {
  // Split endpoint and query string safely
  const endpoint = (data.endpoint || "").split("?")[0];

  // State for formatted body
  const [formattedBody, setFormattedBody] = useState<string>(
    formatBody(data.format, data.body || "")
  );

  // Update formattedBody when body or format changes
  useEffect(() => {
    setFormattedBody(formatBody(data.format, data.body || ""));
  }, [data.body, data.format]);

  // Only call onChange if endpoint value actually changed
  const handleEndpointChange = useCallback(
    (newEndpoint: string) => {
      if (newEndpoint !== data.endpoint) {
        onChange({
          ...data,
          endpoint: newEndpoint,
        });
      }
    },
    [data, onChange]
  );

  // Only call onChange if query value actually changed
  const handleQueryChange = useCallback(
    (query: Record<string, string>) => {
      // Compare stringified versions for shallow equality
      const prev = JSON.stringify(data.query || {});
      const next = JSON.stringify(query || {});
      if (prev !== next) {
        onChange({
          ...data,
          query,
        });
      }
    },
    [data, onChange]
  );

  // Ref for the textarea
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [data.body]);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "80%" }} />
      </colgroup>
      <tbody>
        <tr>
          <td className="label">name</td>
          <td style={{ padding: "8px" }}>
            <FieldWithRemove
              value={data.name}
              onChange={v => onChange({ ...data, name: v })}
              onRemovePressed={onRemove ?? (() => { })}
              placeholder="name"
            />
          </td>
        </tr>
        <tr>
          <td className="label">protocol</td>
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
          <td className="label">format</td>
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
          <td className="label">endpoint</td>
          <td style={{ padding: "8px" }}>
            <EndpointInput
              endpoint={endpoint}
              query={data.query || {}}
              onEndpointChange={handleEndpointChange}
              onQueryChange={handleQueryChange}
            />
          </td>
        </tr>
        {data.protocol === "http" || data.method ? (
          <tr>
            <td className={data.protocol !== "http" ? "label label-disabled" : "label"}>method</td>
            <td style={{ padding: "8px" }}>
              <select
                value={data.method || ""}
                onChange={e => onChange({ ...data, method: e.target.value as Method })}
                style={{ width: "100%" }}
                disabled={data.protocol !== "http"}
              >
                <option value="" disabled>Select method...</option>
                {methodOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </td>
          </tr>
        ) : null}
        {data.protocol === "http" || (data.query && Object.keys(data.query).length > 0) ? (
          <KVEditor
            label="url params"
            value={data.query}
            onChange={handleQueryChange}
            disabled={data.protocol !== "http"}
          />
        ) : null}
        {data.protocol === "http" || (data.headers && Object.keys(data.headers).length > 0) ? (
        <KVEditor
          label="headers"
          value={data.headers}
          onChange={headers => onChange({ ...data, headers })}
          disabled={data.protocol !== "http"} 
        />
        ) : null}
        {data.protocol === "http" || (data.cookies && Object.keys(data.cookies).length > 0) ? (
          <KVEditor
            label="cookies"
            value={data.cookies}
            onChange={cookies => onChange({ ...data, cookies })}
            disabled={data.protocol !== "http"}
          />
        ) : null}
        <tr>
          <td className="label">body</td>
          <td style={{ padding: "8px", position: "relative" }}>
            <BodyView
              value={formattedBody}
              format={data.format}
              mode="interface"
              onChange={val => {
                setFormattedBody(val);
                const yamlObj = formattedBodyToYamlObject(data.format, val);
                if (yamlObj !== null) {
                  onChange({ ...data, body: yamlObj });
                }
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default InterfaceEditor;