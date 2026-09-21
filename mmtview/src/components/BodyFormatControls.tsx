import React, { useEffect, useRef, useState } from "react";
import { Format } from "mmt-core/CommonData";

export type BodyFormatTopLevel = "none" | "multipart" | "raw" | "binary";

export const BODY_FORMAT_TOP_LEVEL: BodyFormatTopLevel[] = ["none", "multipart", "raw", "binary"];
export const RAW_FORMATS: Format[] = ["json", "xml", "xmle", "text", "html", "urlencoded"];
export const DEFAULT_RAW_FORMAT: Format = "json";

export function isRawFormat(format: Format): boolean {
  return RAW_FORMATS.includes(format);
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
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function RawFormatSelect({
  value,
  onChange,
}: {
  value: Format;
  onChange: (format: Format) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

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
        aria-label="Raw body type"
        onClick={() => setMenuOpen(current => !current)}
      >
        <span>{value}</span>
        <span className="codicon codicon-chevron-down" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="apitest-body-format-raw-menu" role="listbox">
          {RAW_FORMATS.map(format => {
            const selected = format === value;
            return (
              <button
                key={format}
                type="button"
                role="option"
                aria-selected={selected}
                className={`apitest-body-format-raw-option${selected ? " is-selected" : ""}`}
                onClick={() => {
                  setMenuOpen(false);
                  onChange(format);
                }}
              >
                {format}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
