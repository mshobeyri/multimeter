import React, { useRef, useEffect } from "react";

export type BodyViewProps = {
  value: string;
  isJsonInvalid?: boolean;
  onChange: (value: string) => void;
  onTab?: (value: string, textarea: HTMLTextAreaElement) => void;
};

const BodyView: React.FC<BodyViewProps> = ({ value, isJsonInvalid, onChange, onTab }) => {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
            const newValue = value.substring(0, start) + spaces + value.substring(end);
            onChange(newValue);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
            }, 0);
            if (onTab) onTab(newValue, textarea);
          }
        }}
        style={{
          width: "100%",
          minHeight: 60,
          resize: "none",
          overflow: "hidden"
        }}
      />
      {isJsonInvalid && (
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
          title="Invalid JSON"
        />
      )}
    </div>
  );
};

export default BodyView;