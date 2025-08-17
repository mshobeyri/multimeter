import React, { useCallback, useRef, useEffect, useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import KVEditor from "../components/KVEditor";
import UrlInput from "../components/UrlInput";
import { InterfaceData } from "./APIData";
import { Protocol, Method, Format } from "../CommonData"
import { formatBody, formattedBodyToYamlObject } from "../markupConvertor";
import BodyView from "../components/BodyView";
import { safeList, isNonEmptyObject } from "../safer";

interface InterfaceEditorProps {
  data: InterfaceData;
  onChange: (data: InterfaceData) => void;
  onRemove?: () => void;
}

const protocolOptions: Protocol[] = ["http", "ws"];
const formatOptions: Format[] = ["json", "xml", "text"];
const methodOptions: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange, onRemove }) => {
  // Split url and query string safely
  const url = (data.url || "").split("?")[0];

  // State for formatted body
  const [formattedBody, setFormattedBody] = useState<string>(
    formatBody(data.format, data.body || "")
  );

  // Update formattedBody when body or format changes
  useEffect(() => {
    if (data.body) {
      setFormattedBody(formatBody(data.format, data.body || ""));
    } else {
      setFormattedBody("");
    }
  }, [data.body, data.format]);

  // Only call onChange if url value actually changed
  const handleUrlChange = useCallback(
    (newUrl: string) => {
      if (newUrl !== data.url) {
        onChange({
          ...data,
          url: newUrl,
        });
      }
    },
    [data, onChange]
  );

  // Only call onChange if query value actually changed
  const handleQueryChange = useCallback(
    (query: Record<string, string | number | boolean>) => {
      // Convert all values to strings
      const stringQuery: Record<string, string> = {};
      Object.entries(query || {}).forEach(([k, v]) => {
        stringQuery[k] = String(v);
      });
      // Compare stringified versions for shallow equality
      const prev = JSON.stringify(data.query || {});
      const next = JSON.stringify(stringQuery || {});
      if (prev !== next) {
        onChange({
          ...data,
          query: stringQuery,
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
    <div style={{ width: "100%" }}>

      <div className="label">name</div>
      <div style={{ padding: "5px" }}>
        <FieldWithRemove
          value={data.name}
          onChange={v => onChange({ ...data, name: v })}
          onRemovePressed={onRemove ?? (() => { })}
          placeholder="name"
        />
      </div>


      <div className="label">protocol</div>
      <div style={{ padding: "5px" }}>
        <select
          value={data.protocol}
          onChange={e => onChange({ ...data, protocol: e.target.value as Protocol })}
          style={{ width: "100%" }}
        >
          {safeList(protocolOptions).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>


      <div className="label">format</div>
      <div style={{ padding: "5px" }}>
        <select
          value={data.format}
          onChange={e => onChange({ ...data, format: e.target.value as Format })}
          style={{ width: "100%" }}
        >
          {safeList(formatOptions).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>


      <div className="label">url</div>
      <div style={{ padding: "5px" }}>
        <UrlInput
          url={url}
          query={data.query || {}}
          onUrlChange={handleUrlChange}
          onQueryChange={handleQueryChange}
        />
      </div>

      {data.protocol === "http" || data.method ? (
        <>
          <div className={data.protocol && data.protocol !== "http" ? "label label-disabled" : "label"}>method</div>
          <div style={{ padding: "5px" }}>
            <select
              value={data.method || ""}
              onChange={e => onChange({ ...data, method: e.target.value as Method })}
              style={{ width: "100%" }}
              disabled={data.protocol && data.protocol !== "http"}
            >
              <option value="" disabled>Select method...</option>
              {safeList(methodOptions).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {data.protocol === "http" || isNonEmptyObject(data.query) ? (
        <KVEditor
          label="query"
          value={data.query || {}}
          onChange={handleQueryChange}
          disabled={data.protocol !== "http"}
        />
      ) : null}
      {data.protocol === "http" || isNonEmptyObject(data.headers) ? (
        <KVEditor
          label="headers"
          value={data.headers || {}}
          onChange={headers => {
            const stringHeaders: Record<string, string> = {};
            Object.entries(headers).forEach(([k, v]) => {
              stringHeaders[k] = String(v);
            });
            onChange({ ...data, headers: stringHeaders });
          }}
          disabled={data.protocol !== "http"}
        />
      ) : null}
      {data.protocol === "http" || isNonEmptyObject(data.cookies) ? (
        <KVEditor
          label="cookies"
          value={data.cookies || {}}
          onChange={cookies => {
            const stringCookies: Record<string, string> = {};
            Object.entries(cookies).forEach(([k, v]) => {
              stringCookies[k] = String(v);
            });
            onChange({ ...data, cookies: stringCookies });
          }}
          disabled={data.protocol !== "http"}
        />
      ) : null}
      {/* Only show body editor if method is not get */}
      {(data.protocol == "ws" || !data.method || data.method.toLowerCase() !== "get") && (
        
          <>
            <div className="label">body</div>
            <div style={{ padding: "5px", position: "relative" }}>
              <BodyView
                value={formattedBody === null ? "" : formattedBody}
                format={data.format}
                mode="appliable"
                onChange={val => {
                  setFormattedBody(val);
                  const yamlObj = formattedBodyToYamlObject(data.format, val);
                  if (yamlObj !== null) {
                    onChange({ ...data, body: yamlObj });
                  }
                }}
              />
            </div>
          </>

      )}
    </div>
  );
};

export default InterfaceEditor;