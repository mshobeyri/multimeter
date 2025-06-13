import React, { useRef, useEffect, useState } from "react";
import { xml2js } from "xml-js";

export type BodyViewProps = {
  value: string;
  format: string;
  onChange: (value: string) => void;
};

const BodyView: React.FC<BodyViewProps> = ({ value, format, onChange }) => {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [isInvalid, setIsInvalid] = useState(false);

  // Validate JSON or XML when value or format changes
  useEffect(() => {
    if (format === "json") {
      try {
        JSON.parse(value);
        setIsInvalid(false);
      } catch {
        setIsInvalid(true);
      }
    } else if (format === "xml") {
      try {
        xml2js(value, { compact: true });
        setIsInvalid(false);
      } catch {
        setIsInvalid(true);
      }
    } else {
      setIsInvalid(false);
    }
  }, [value, format]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={bodyRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Tab") {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const spaces = "  ";
            // Use setRangeText to insert spaces and preserve undo stack
            textarea.setRangeText(spaces, start, end, "end");
            // Manually trigger onChange with the new value
            onChange(textarea.value);
          }
        }}
        style={{
          width: "100%",
          minHeight: 60,
          resize: "none",
          overflow: "hidden"
        }}
      />
      {isInvalid && (
        <span
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "red",
            display: "inline-block",
            boxShadow: "0 0 2px #900"
          }}
          title={format === "json" ? "Invalid JSON" : format === "xml" ? "Invalid XML" : "Invalid"}
        />
      )}
    </div>
  );
};

export default BodyView;