import React, { useEffect, useRef, useState } from "react";
import { Method, Protocol } from "mmt-core/CommonData";
import { buildQueryString, parseQueryString } from "./UrlInput";

const HTTP_METHODS: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
const OTHER_PROTOCOLS: Protocol[] = ["ws", "graphql", "grpc"];

const PROTOCOL_LABELS: Record<string, string> = {
  ws: "WS",
  graphql: "GraphQL",
  grpc: "gRPC",
};

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
  onQueryChange(parseQueryString(queryParts.join("?")));
}

type MethodUrlBarProps = {
  methodValue: string;
  onMethodChange: (value: string) => void;
  url: string;
  query: Record<string, string>;
  onUrlChange: (url: string) => void;
  onQueryChange: (query: Record<string, string>) => void;
  /** Red dot: URL/query still has unresolved r:/c: preview that refreshes on Send. */
  showRuntimeDot?: boolean;
};

const MethodUrlBar: React.FC<MethodUrlBarProps> = ({
  methodValue,
  onMethodChange,
  url,
  query,
  onUrlChange,
  onQueryChange,
  showRuntimeDot = false,
}) => {
  const urlValue = url + buildQueryString(query);
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
          title="HTTP method or protocol (temporary override)"
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
      <div className={`method-url-bar-url-wrap${showRuntimeDot ? " has-runtime-dot" : ""}`}>
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
        {showRuntimeDot ? (
          <span className="mmt-runtime-dot" title="Refreshes on Send (r:/c:)" aria-hidden />
        ) : null}
      </div>
    </div>
  );
};

export default MethodUrlBar;
