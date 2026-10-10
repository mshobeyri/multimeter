import React, { useEffect, useRef, useState } from "react";
import TokenFieldInput from "./TokenFieldInput";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

type BlurCommitInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "defaultValue"
> & {
  value: string;
  onCommit: (value: string) => void;
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
};

/**
 * Text input that keeps a local draft while focused and calls onCommit
 * on blur or Enter — for peer YAML fields that should not write mid-keystroke.
 * With `canContainToken`, token-bearing values use resolved preview / token edit.
 */
const BlurCommitInput: React.FC<BlurCommitInputProps> = ({
  value,
  onCommit,
  canContainToken = false,
  valueContext,
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

  if (canContainToken) {
    return (
      <TokenFieldInput
        {...rest}
        value={value}
        canContainToken
        valueContext={valueContext}
        onCommit={onCommit}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
    );
  }

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
