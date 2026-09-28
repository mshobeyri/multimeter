import React, { useEffect, useRef, useState } from "react";

type BlurCommitInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "defaultValue"
> & {
  value: string;
  onCommit: (value: string) => void;
};

/**
 * Text input that keeps a local draft while focused and calls onCommit
 * on blur or Enter — for peer YAML fields that should not write mid-keystroke.
 */
const BlurCommitInput: React.FC<BlurCommitInputProps> = ({
  value,
  onCommit,
  onFocus,
  onKeyDown,
  ...rest
}) => {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  return (
    <input
      {...rest}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={e => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={() => {
        focusedRef.current = false;
        onCommit(draft);
      }}
      onKeyDown={e => {
        onKeyDown?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(draft);
          e.currentTarget.blur();
        }
      }}
    />
  );
};

export default BlurCommitInput;
