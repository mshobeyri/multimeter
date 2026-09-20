import React, { useEffect, useRef } from "react";
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
};

const MethodUrlBar: React.FC<MethodUrlBarProps> = ({
  methodValue,
  onMethodChange,
  url,
  query,
  onUrlChange,
  onQueryChange,
}) => {
  const urlRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const urlValue = url + buildQueryString(query);

  useEffect(() => {
    const el = urlRef.current;
    if (!el || focusedRef.current) {
      return;
    }
    if ((el.textContent || "") !== urlValue) {
      el.textContent = urlValue;
    }
  }, [urlValue]);

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
      <div
        ref={urlRef}
        className="method-url-bar-url"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        spellCheck={false}
        aria-label="Request URL"
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={event => {
          focusedRef.current = false;
          emitUrl(event.currentTarget.textContent || "", onUrlChange, onQueryChange);
        }}
        onInput={event => {
          emitUrl(event.currentTarget.textContent || "", onUrlChange, onQueryChange);
        }}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onPaste={event => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, "");
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
};

export default MethodUrlBar;
