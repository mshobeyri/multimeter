import React, { useRef, useEffect, useState } from "react";

interface AutoSizeTextFieldProps {
  value: string;
  minWidth?: number;
  maxWidth?: number;
  style?: React.CSSProperties;
  readOnly?: boolean;
  onChange?: (val: string) => void;
}

const AutoSizeTextField: React.FC<AutoSizeTextFieldProps> = ({
  value,
  minWidth = 40,
  maxWidth = 300,
  style,
  readOnly = false,
  onChange,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState(minWidth);

  useEffect(() => {
    if (spanRef.current) {
      const width = Math.min(
        Math.max(spanRef.current.offsetWidth + 12, minWidth),
        maxWidth
      );
      setInputWidth(width);
    }
  }, [value, minWidth, maxWidth]);

  return (
    <>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          width: inputWidth,
          minWidth,
          maxWidth,
          boxSizing: "content-box",
          ...style,
        }}
      />
      {/* Hidden span to measure text width */}
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          height: 0,
          overflow: "hidden",
          whiteSpace: "pre",
          fontSize: "inherit",
          fontFamily: "inherit",
          fontWeight: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {value}
      </span>
    </>
  );
};

export default AutoSizeTextField;