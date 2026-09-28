import React, { useEffect, useRef, useState } from "react";
import { Format, RequestFormat, ResponseFormat } from "mmt-core/CommonData";

export type BodyFormatTopLevel = "none" | "multipart" | "raw" | "binary";

export const BODY_FORMAT_TOP_LEVEL: BodyFormatTopLevel[] = ["none", "multipart", "raw", "binary"];
export const RESPONSE_BODY_FORMAT_TOP_LEVEL: Exclude<BodyFormatTopLevel, "none">[] = [
  "multipart",
  "raw",
  "binary",
];
export const RAW_FORMATS = ["json", "xml", "xmle", "text", "html", "urlencoded"] as const satisfies readonly Format[];
export type RawBodyFormat = typeof RAW_FORMATS[number];
export const DEFAULT_RAW_FORMAT: RawBodyFormat = "json";

export type BodyFormatMenuEntry<T extends string> =
  | { kind: "option"; value: T }
  | { kind: "heading"; label: string };

/** Request menu: auto, none, binary, multipart, then raw types. */
export const REQUEST_BODY_FORMAT_MENU: readonly BodyFormatMenuEntry<RequestFormat>[] = [
  { kind: "option", value: "auto" },
  { kind: "option", value: "none" },
  { kind: "option", value: "binary" },
  { kind: "option", value: "multipart" },
  { kind: "heading", label: "raw" },
  { kind: "option", value: "json" },
  { kind: "option", value: "xml" },
  { kind: "option", value: "xmle" },
  { kind: "option", value: "text" },
  { kind: "option", value: "html" },
  { kind: "option", value: "urlencoded" },
];

/** Response menu: auto, binary, multipart, then raw types (no none). */
export const RESPONSE_BODY_FORMAT_MENU: readonly BodyFormatMenuEntry<ResponseFormat>[] = [
  { kind: "option", value: "auto" },
  { kind: "option", value: "binary" },
  { kind: "option", value: "multipart" },
  { kind: "heading", label: "raw" },
  { kind: "option", value: "json" },
  { kind: "option", value: "xml" },
  { kind: "option", value: "xmle" },
  { kind: "option", value: "text" },
  { kind: "option", value: "html" },
  { kind: "option", value: "urlencoded" },
];

/** @deprecated Prefer REQUEST_BODY_FORMAT_MENU. */
export const REQUEST_BODY_FORMAT_OPTIONS: readonly RequestFormat[] =
  REQUEST_BODY_FORMAT_MENU.filter(
    (entry): entry is { kind: "option"; value: RequestFormat } => entry.kind === "option",
  ).map(entry => entry.value);

/** @deprecated Prefer RESPONSE_BODY_FORMAT_MENU. */
export const RESPONSE_BODY_FORMAT_OPTIONS: readonly ResponseFormat[] =
  RESPONSE_BODY_FORMAT_MENU.filter(
    (entry): entry is { kind: "option"; value: ResponseFormat } => entry.kind === "option",
  ).map(entry => entry.value);

export function isRawFormat(format: Format): format is RawBodyFormat {
  return (RAW_FORMATS as readonly Format[]).includes(format);
}

export function topLevelForFormat(format: Format): BodyFormatTopLevel {
  if (format === "none" || format === "multipart" || format === "binary") {
    return format;
  }
  return "raw";
}

export function FormatChip({
  label,
  selected,
  title,
  onClick,
}: {
  label: string;
  selected: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`apitest-body-format-chip${selected ? " is-selected" : ""}`}
      title={title}
      // Don't steal focus from Monaco (body edit blur would exit edit mode).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function BodyFormatSelect<T extends string>({
  value,
  menu,
  options,
  onChange,
  ariaLabel = "Body format",
}: {
  value: T;
  menu?: readonly BodyFormatMenuEntry<T>[];
  /** Flat options when `menu` is not provided. */
  options?: readonly T[];
  onChange: (format: T) => void;
  ariaLabel?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const entries: readonly BodyFormatMenuEntry<T>[] = menu
    ?? (options ?? []).map(option => ({ kind: "option" as const, value: option }));

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  return (
    <div className="apitest-body-format-raw-select" ref={selectRef}>
      <button
        type="button"
        className="apitest-body-format-raw-trigger"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-label={ariaLabel}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setMenuOpen(current => !current)}
      >
        <span>{value}</span>
        <span className="codicon codicon-chevron-down" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="apitest-body-format-raw-menu" role="listbox">
          {(() => {
            let underRaw = false;
            return entries.map((entry, index) => {
              if (entry.kind === "heading") {
                underRaw = entry.label.toLowerCase() === "raw";
                return (
                  <div
                    key={`heading-${entry.label}-${index}`}
                    className="apitest-body-format-raw-heading"
                    role="presentation"
                  >
                    {entry.label}
                  </div>
                );
              }
              const selected = entry.value === value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={[
                    "apitest-body-format-raw-option",
                    selected ? "is-selected" : "",
                    underRaw ? "is-raw-child" : "",
                  ].filter(Boolean).join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMenuOpen(false);
                    onChange(entry.value);
                  }}
                >
                  {entry.value}
                </button>
              );
            });
          })()}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer BodyFormatSelect with REQUEST/RESPONSE_BODY_FORMAT_MENU. */
export function RawFormatSelect({
  value,
  onChange,
}: {
  value: RawBodyFormat;
  onChange: (format: RawBodyFormat) => void;
}) {
  return (
    <BodyFormatSelect
      value={value}
      options={RAW_FORMATS}
      onChange={onChange}
      ariaLabel="Raw body type"
    />
  );
}
