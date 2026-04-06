import React, { useCallback, useRef, useEffect, useState } from "react";
import KSVEditor from "../components/KSVEditor";
import UrlInput from "../components/UrlInput";
import { Protocol, Method, Format } from "mmt-core/CommonData"
import { formatBody, formattedBodyToYamlObject } from "mmt-core/markupConvertor";
import BodyView from "../components/BodyView";
import { safeList, isNonEmptyObject } from "mmt-core/safer";
import { JSONRecord } from "mmt-core/CommonData";
import { APIData, AuthConfig } from "mmt-core/APIData";
import { protocolResolver } from "mmt-core";

interface InterfaceEditorProps {
  data: APIData;
  onChange: (data: APIData) => void;
}

const protocolOptions: Protocol[] = ["http", "ws", "graphql", "grpc"];
const formatOptions: Format[] = ["json", "xml", "text"];
const methodOptions: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
const authTypeOptions = ["none", "bearer", "basic", "api-key", "oauth2"] as const;
const apiKeyPlacementOptions = ["header", "query"] as const;

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

      {effectiveProtocol !== "graphql" && effectiveProtocol !== "grpc" && (
        <>
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
        </>
      )}

      <div className="label">URL</div>
      <div style={{ padding: "5px" }}>
        <UrlInput
          url={url}
          query={data.query || {}}
          onUrlChange={handleUrlChange}
          onQueryChange={handleQueryChange}
        />
      </div>

      {effectiveProtocol !== "graphql" && effectiveProtocol !== "grpc" && (effectiveProtocol === "http" || data.method) ? (
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
      {effectiveProtocol !== "graphql" && effectiveProtocol !== "grpc" && (effectiveProtocol === "http" || isNonEmptyObject(data.query)) ? (
        <KSVEditor
          label="Query"
          value={data.query || {}}
          onChange={handleQueryChange}
          disabled={effectiveProtocol !== "http"}
        />
      ) : null}

      {/* Auth section */}
      <div className="label">Auth</div>
      <div style={{ padding: "5px" }}>
        <select
          value={!data.auth ? '' : data.auth === 'none' ? 'none' : data.auth.type}
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              const { auth: _, ...rest } = data;
              onChange(rest as APIData);
            } else if (val === 'none') {
              onChange({ ...data, auth: 'none' });
            } else if (val === 'bearer') {
              onChange({ ...data, auth: { type: 'bearer', token: '' } });
            } else if (val === 'basic') {
              onChange({ ...data, auth: { type: 'basic', username: '', password: '' } });
            } else if (val === 'api-key') {
              onChange({ ...data, auth: { type: 'api-key', header: '', value: '' } });
            } else if (val === 'oauth2') {
              onChange({ ...data, auth: { type: 'oauth2', grant: 'client_credentials', token_url: '', client_id: '', client_secret: '' } });
            }
          }}
          style={{ width: "100%" }}
        >
          <option value="">(none)</option>
          {authTypeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {data.auth && data.auth !== 'none' && data.auth.type === 'bearer' && (
          <div style={{ marginTop: 4 }}>
            <input
              type="text"
              placeholder="Token"
              value={data.auth.token}
              onChange={e => onChange({ ...data, auth: { ...data.auth as any, token: e.target.value } })}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {data.auth && data.auth !== 'none' && data.auth.type === 'basic' && (
          <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
            <input
              type="text"
              placeholder="Username"
              value={data.auth.username}
              onChange={e => onChange({ ...data, auth: { ...data.auth as any, username: e.target.value } })}
              style={{ flex: 1 }}
            />
            <input
              type="password"
              placeholder="Password"
              value={data.auth.password}
              onChange={e => onChange({ ...data, auth: { ...data.auth as any, password: e.target.value } })}
              style={{ flex: 1 }}
            />
          </div>
        )}

        {data.auth && data.auth !== 'none' && data.auth.type === 'api-key' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <select
                value={data.auth.header != null ? 'header' : 'query'}
                onChange={e => {
                  const placement = e.target.value as 'header' | 'query';
                  const current = data.auth as { type: 'api-key'; header?: string; query?: string; value: string };
                  const name = current.header ?? current.query ?? '';
                  if (placement === 'header') {
                    onChange({ ...data, auth: { type: 'api-key', header: name, value: current.value } });
                  } else {
                    onChange({ ...data, auth: { type: 'api-key', query: name, value: current.value } });
                  }
                }}
                style={{ width: 90 }}
              >
                {apiKeyPlacementOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Key name"
                value={data.auth.header ?? data.auth.query ?? ''}
                onChange={e => {
                  const current = data.auth as { type: 'api-key'; header?: string; query?: string; value: string };
                  if (current.header != null) {
                    onChange({ ...data, auth: { type: 'api-key', header: e.target.value, value: current.value } });
                  } else {
                    onChange({ ...data, auth: { type: 'api-key', query: e.target.value, value: current.value } });
                  }
                }}
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="text"
              placeholder="Value"
              value={data.auth.value}
              onChange={e => onChange({ ...data, auth: { ...data.auth as any, value: e.target.value } })}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {data.auth && data.auth !== 'none' && data.auth.type === 'oauth2' && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              type="text"
              placeholder="Token URL"
              value={data.auth.token_url}
              onChange={e => onChange({ ...data, auth: { ...data.auth as any, token_url: e.target.value } })}
              style={{ width: "100%" }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                placeholder="Client ID"
                value={data.auth.client_id}
                onChange={e => onChange({ ...data, auth: { ...data.auth as any, client_id: e.target.value } })}
                style={{ flex: 1 }}
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={data.auth.client_secret}
                onChange={e => onChange({ ...data, auth: { ...data.auth as any, client_secret: e.target.value } })}
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="text"
              placeholder="Scope (optional)"
              value={data.auth.scope ?? ''}
              onChange={e => {
                const scope = e.target.value || undefined;
                onChange({ ...data, auth: { ...data.auth as any, scope } });
              }}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {effectiveProtocol === "http" || effectiveProtocol === "graphql" || effectiveProtocol === "grpc" || isNonEmptyObject(data.headers) ? (
        <KSVEditor
          label={effectiveProtocol === "grpc" ? "Metadata" : "Headers"}
          value={data.headers || {}}
          onChange={headers => {
            const stringHeaders: Record<string, string> = {};
            Object.entries(headers).forEach(([k, v]) => {
              stringHeaders[k] = String(v);
            });
            onChange({ ...data, headers: stringHeaders });
          }}
          disabled={effectiveProtocol !== "http" && effectiveProtocol !== "graphql" && effectiveProtocol !== "grpc"}
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

      {/* Only show body editor if method is not get and protocol is not graphql/grpc */}
      {effectiveProtocol !== "graphql" && effectiveProtocol !== "grpc" && (effectiveProtocol === "ws" || !data.method || data.method.toLowerCase() !== "get") && (
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
