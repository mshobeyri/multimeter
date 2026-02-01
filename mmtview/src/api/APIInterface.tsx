import React, { useCallback, useRef, useEffect, useState } from "react";
import KSVEditor from "../components/KSVEditor";
import UrlInput from "../components/UrlInput";
import { Protocol, Method, Format } from "mmt-core/CommonData"
import { formatBody, formattedBodyToYamlObject } from "mmt-core/markupConvertor";
import BodyView from "../components/BodyView";
import { safeList, isNonEmptyObject } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";
import { APIData } from "mmt-core/APIData";
import { protocolResolver } from "mmt-core";

interface InterfaceEditorProps {
  data: APIData;
  onChange: (data: APIData) => void;
}

const protocolOptions: Protocol[] = ["http", "ws"];
const formatOptions: Format[] = ["json", "xml", "text"];
const methodOptions: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];

const InterfaceEditor: React.FC<InterfaceEditorProps> = ({ data, onChange }) => {
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
    (query: JSONRecord) => {
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

  const effectiveProtocol = protocolResolver.getEffectiveProtocol(data.protocol as any, data.url);

  return (
    <div style={{ width: "100%" }}>
      <div className="label">Protocol</div>
      <div style={{ padding: "5px" }}>
        <select
          value={data.protocol || ""}
          onChange={e => onChange({ ...data, protocol: e.target.value as Protocol || undefined })}
          style={{ width: "100%" }}
        >
          <option key="" value="">(auto - inferred from URL)</option>
          {safeList(protocolOptions).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="label">Format</div>
      <div style={{ padding: "5px" }}>
        <select
          value={data.format}
          onChange={e => onChange({ ...data, format: e.target.value as Format })}
          style={{ width: "100%" }}
        >
          <option key="" value="" disabled>Select format...</option>
          {safeList(formatOptions).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div className="label">URL</div>
      <div style={{ padding: "5px" }}>
        <UrlInput
          url={url}
          query={data.query || {}}
          onUrlChange={handleUrlChange}
          onQueryChange={handleQueryChange}
        />
      </div>

      {effectiveProtocol === "http" || data.method ? (
        <>
          <div className={effectiveProtocol !== "http" ? "label label-disabled" : "label"}>Method</div>
          <div style={{ padding: "5px" }}>
            <select
              value={data.method || ""}
              onChange={e => onChange({ ...data, method: e.target.value as Method })}
              style={{ width: "100%" }}
              disabled={effectiveProtocol !== "http"}
            >
              <option value="" disabled>Select method...</option>
              {safeList(methodOptions).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {effectiveProtocol === "http" || isNonEmptyObject(data.query) ? (
        <KSVEditor
          label="Query"
          value={data.query || {}}
          onChange={handleQueryChange}
          disabled={effectiveProtocol !== "http"}
        />
      ) : null}
      {effectiveProtocol === "http" || isNonEmptyObject(data.headers) ? (
        <KSVEditor
          label="Headers"
          value={data.headers || {}}
          onChange={headers => {
            const stringHeaders: Record<string, string> = {};
            Object.entries(headers).forEach(([k, v]) => {
              stringHeaders[k] = String(v);
            });
            onChange({ ...data, headers: stringHeaders });
          }}
          disabled={effectiveProtocol !== "http"}
        />
      ) : null}
      {effectiveProtocol === "http" || isNonEmptyObject(data.cookies) ? (
        <KSVEditor
          label="Cookies"
          value={data.cookies || {}}
          onChange={cookies => {
            const stringCookies: Record<string, string> = {};
            Object.entries(cookies).forEach(([k, v]) => {
              stringCookies[k] = String(v);
            });
            onChange({ ...data, cookies: stringCookies });
          }}
          disabled={effectiveProtocol !== "http"}
        />
      ) : null}
      {/* Only show body editor if method is not get */}
      {(effectiveProtocol === "ws" || !data.method || data.method.toLowerCase() !== "get") && (
        <>
          <div className="label">Body</div>
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