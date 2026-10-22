import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Method, Protocol } from "mmt-core/data/CommonData";
import {
  urlBarTokenPreviewCacheKey,
  type RuntimeTokenValueContext,
} from "mmt-core/api-edit/apiBodyEdit";
import StableTextInput from "./StableTextInput";
import TokenFieldInput from "./TokenFieldInput";

const HTTP_METHODS: Method[] = ["get", "post", "put", "delete", "patch", "head", "options", "trace"];
const OTHER_PROTOCOLS: Protocol[] = ["ws", "graphql", "grpc"];

const PROTOCOL_LABELS: Record<string, string> = {
  ws: "WS",
  graphql: "GraphQL",
  grpc: "gRPC",
};

type MethodMenuOption = {
  value: string;
  label: string;
};

const METHOD_OPTIONS: MethodMenuOption[] = HTTP_METHODS.map(method => ({
  value: `method:${method}`,
  label: method.toUpperCase(),
}));

const PROTOCOL_OPTIONS: MethodMenuOption[] = OTHER_PROTOCOLS.map(protocol => ({
  value: `protocol:${protocol}`,
  label: PROTOCOL_LABELS[protocol] || protocol.toUpperCase(),
}));

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
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
};

/** Method + URL bar; URL/query edits write live into the API YAML peer. */
const MethodUrlBar: React.FC<MethodUrlBarProps> = ({
  methodValue,
  onMethodChange,
  url,
  query,
  onUrlChange,
  onQueryChange,
  canContainToken = false,
  valueContext,
}) => {
  const urlValue = url + joinQueryForEditor(query);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    top: number;
    minWidth: number;
    accentFill: string;
    accentOnFill: string;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const minWidth = Math.max(112, rect.width);
      const margin = 8;
      const left = Math.min(
        Math.max(margin, rect.left),
        window.innerWidth - minWidth - margin,
      );
      const top = Math.min(rect.bottom + 4, window.innerHeight - margin);
      const accentSource = rootRef.current || triggerRef.current;
      const accentStyle = accentSource ? getComputedStyle(accentSource) : null;
      setMenuPos({
        left,
        top,
        minWidth,
        accentFill: accentStyle?.getPropertyValue("--mmt-accent-fill").trim() || "",
        accentOnFill: accentStyle?.getPropertyValue("--mmt-accent-on-fill").trim() || "",
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen, methodValue]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const renderOption = (option: MethodMenuOption) => {
    const selected = option.value === methodValue;
    return (
      <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={selected}
        className={`method-url-bar-option${selected ? " is-selected" : ""}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          setMenuOpen(false);
          onMethodChange(option.value);
        }}
      >
        {option.label}
      </button>
    );
  };

  const menuNode = menuOpen && menuPos ? (
    <div
      ref={menuRef}
      className="method-url-bar-menu"
      role="listbox"
      aria-label="HTTP method or protocol"
      style={{
        position: "fixed",
        left: menuPos.left,
        top: menuPos.top,
        minWidth: menuPos.minWidth,
        zIndex: 1000,
        ["--mmt-accent-fill" as string]: menuPos.accentFill || undefined,
        ["--mmt-accent-on-fill" as string]: menuPos.accentOnFill || undefined,
      }}
    >
      {METHOD_OPTIONS.map(renderOption)}
      <div className="method-url-bar-menu-sep" role="separator" />
      {PROTOCOL_OPTIONS.map(renderOption)}
    </div>
  ) : null;

  return (
    <div className="method-url-bar">
      <div className="method-url-bar-method" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className={`method-url-bar-trigger${menuOpen ? " is-open" : ""}`}
          title="HTTP method or protocol"
          aria-label="HTTP method or protocol"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(current => !current)}
        >
          <span className="method-url-bar-method-label">{methodUrlBarLabel(methodValue)}</span>
        </button>
        {menuNode ? createPortal(menuNode, document.body) : null}
      </div>
      <div className="method-url-bar-url-wrap">
        {canContainToken ? (
          <TokenFieldInput
            type="text"
            className="method-url-bar-url"
            value={urlValue}
            canContainToken
            valueContext={valueContext}
            tokenCacheScope={urlBarTokenPreviewCacheKey}
            spellCheck={false}
            aria-label="Request URL"
            onCommit={value => emitUrl(value, onUrlChange, onQueryChange)}
            onDraftChange={value => emitUrl(value, onUrlChange, onQueryChange)}
          />
        ) : (
          <StableTextInput
            type="text"
            className="method-url-bar-url"
            value={urlValue}
            onChange={next => emitUrl(next, onUrlChange, onQueryChange)}
            spellCheck={false}
            aria-label="Request URL"
          />
        )}
      </div>
    </div>
  );
};

export default MethodUrlBar;
