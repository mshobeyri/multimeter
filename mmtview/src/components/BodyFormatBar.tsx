import React, { useEffect, useRef, useState } from "react";
import { Format } from "mmt-core/CommonData";

type BodyFormatBarProps = {
  value: Format;
  onChange: (format: Format) => void;
};

type TopLevel = "none" | "multipart" | "raw" | "binary";

const TOP_LEVEL: TopLevel[] = ["none", "multipart", "raw", "binary"];
const RAW_FORMATS: Format[] = ["json", "xml", "xmle", "text", "html", "urlencoded"];
const DEFAULT_RAW: Format = "json";

function isRawFormat(format: Format): boolean {
  return RAW_FORMATS.includes(format);
}

function topLevelFor(format: Format): TopLevel {
  if (format === "none" || format === "multipart" || format === "binary") {
    return format;
  }
  return "raw";
}

function FormatChip({
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

const BodyFormatBar: React.FC<BodyFormatBarProps> = ({ value, onChange }) => {
  const rawSelected = isRawFormat(value);
  const [lastRawFormat, setLastRawFormat] = useState<Format>(
    rawSelected ? value : DEFAULT_RAW
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rawSelected) {
      setLastRawFormat(value);
    }
  }, [rawSelected, value]);

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

  const selectTopLevel = (level: TopLevel) => {
    setMenuOpen(false);
    if (level === "raw") {
      onChange(rawSelected ? value : lastRawFormat);
      return;
    }
    onChange(level);
  };

  return (
    <div className="apitest-body-format-bar" role="tablist" aria-label="Body format">
      {TOP_LEVEL.map(level => (
        <FormatChip
          key={level}
          label={level}
          selected={topLevelFor(value) === level}
          title={level === "multipart" ? "multipart/form-data (Postman form-data)" : undefined}
          onClick={() => selectTopLevel(level)}
        />
      ))}
      {rawSelected ? (
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
                      setLastRawFormat(format);
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
      ) : null}
    </div>
  );
};

export default BodyFormatBar;
