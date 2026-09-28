import React, { useEffect, useRef, useState } from "react";
import { Method, Protocol } from "mmt-core/CommonData";

const HTTP_METHODS: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
const OTHER_PROTOCOLS: Protocol[] = ["ws", "graphql", "grpc"];

const PROTOCOL_LABELS: Record<string, string> = {
  ws: "WS",
  graphql: "GraphQL",
  grpc: "gRPC",
};

/** Join query for the URL editor without percent-encoding `{{…}}` tokens. */
function joinQueryForEditor(query: Record<string, string> = {}): string {
  const entries = Object.entries(query).filter(([k]) => k);
  if (entries.length === 0) {
    return "";
  }
  return "?" + entries.map(([k, v]) => `${k}=${v ?? ""}`).join("&");
}

/** Parse query from the URL editor (token-friendly, no decode required). */
function parseQueryForEditor(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!qs) {
    return result;
  }
  const clean = qs.startsWith("?") ? qs.slice(1) : qs;
  for (const pair of clean.split("&")) {
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf("=");
    if (eq < 0) {
      result[pair] = "";
      continue;
    }
    result[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return result;
}

function methodUrlBarLabel(value: string): string {
  if (value.startsWith("protocol:")) {
    const protocol = value.slice("protocol:".length);
    return PROTOCOL_LABELS[protocol] || protocol.toUpperCase();
  }
  if (value.startsWith("method:")) {
    return value.slice("method:".length).toUpperCase();
  }
  return value.toUpperCase();
}

function emitUrl(value: string, onUrlChange: (url: string) => void, onQueryChange: (query: Record<string, string>) => void) {
  const [base, ...queryParts] = value.split("?");
  onUrlChange(base);
  onQueryChange(parseQueryForEditor(queryParts.join("?")));
}

type MethodUrlBarProps = {
  methodValue: string;
  onMethodChange: (value: string) => void;
  url: string;
  query: Record<string, string>;
  onUrlChange: (url: string) => void;
  onQueryChange: (query: Record<string, string>) => void;
};

const MethodUrlBar: React.FC<MethodUrlBarProps> = ({
  methodValue,
  onMethodChange,
  url,
  query,
  onUrlChange,
  onQueryChange,
}) => {
  const urlValue = url + joinQueryForEditor(query);
  const [inputValue, setInputValue] = useState(urlValue);
  const isUserInput = useRef(false);

  useEffect(() => {
    if (!isUserInput.current && urlValue !== inputValue) {
      setInputValue(urlValue);
    }
    isUserInput.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    isUserInput.current = true;
    emitUrl(value, onUrlChange, onQueryChange);
  };

  return (
    <div className="method-url-bar">
      <div className="method-url-bar-method">
        <span className="method-url-bar-method-label">{methodUrlBarLabel(methodValue)}</span>
        <select
          className="method-url-bar-select"
          value={methodValue}
          onChange={e => onMethodChange(e.target.value)}
          title="HTTP method or protocol"
          aria-label="HTTP method or protocol"
        >
          {HTTP_METHODS.map(method => (
            <option key={method} value={`method:${method}`}>{method.toUpperCase()}</option>
          ))}
          <option disabled value="__sep__">────────</option>
          {OTHER_PROTOCOLS.map(protocol => (
            <option key={protocol} value={`protocol:${protocol}`}>
              {PROTOCOL_LABELS[protocol] || protocol}
            </option>
          ))}
        </select>
      </div>
      <div className="method-url-bar-url-wrap">
        <input
          type="text"
          className="method-url-bar-url"
          value={inputValue}
          onChange={handleChange}
          spellCheck={false}
          aria-label="Request URL"
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
};

export default MethodUrlBar;
