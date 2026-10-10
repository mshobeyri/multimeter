import React, { forwardRef, useEffect, useRef, useState } from "react";
import { shouldAdoptFieldValue } from "./fieldValueSync";

type StableTextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue"
> & {
  value: string;
  onChange: (value: string) => void;
};

/** Local text that ignores a same-value echo and ignores parent updates while focused. */
export function useStableFieldDraft(value: string, locked = false) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!shouldAdoptFieldValue(draftRef.current, value, focusedRef.current && !locked)) {
      return;
    }
    setDraft(value);
  }, [value, locked]);

  return {
    draft,
    setDraft,
    focusProps: {
      onFocus: () => {
        focusedRef.current = true;
      },
      onBlur: () => {
        focusedRef.current = false;
        // After editing, show a canonical echo (trimmed number, quotes) once
        // the caret no longer matters. Same text is left untouched.
        if (draftRef.current !== value) {
          setDraft(value);
        }
      },
    },
  };
}

/**
 * Text input that ignores a parent/YAML echo when it matches the current text,
 * and keeps the in-progress draft while focused so the caret is not pushed
 * to the end.
 */
const StableTextInput = forwardRef<HTMLInputElement, StableTextInputProps>(
  function StableTextInput(
    { value, onChange, onFocus, onBlur, disabled, readOnly, ...rest },
    ref,
  ) {
    const locked = Boolean(disabled || readOnly);
    const { draft, setDraft, focusProps } = useStableFieldDraft(value, locked);

    return (
      <input
        {...rest}
        ref={ref}
        value={draft}
        disabled={disabled}
        readOnly={readOnly}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          onChange(next);
        }}
        onFocus={e => {
          focusProps.onFocus();
          onFocus?.(e);
        }}
        onBlur={e => {
          focusProps.onBlur();
          onBlur?.(e);
        }}
      />
    );
  },
);

export default StableTextInput;

type StableTextAreaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "defaultValue"
> & {
  value: string;
  onChange: (value: string) => void;
};

/** Textarea twin of {@link StableTextInput}. */
export const StableTextArea = forwardRef<HTMLTextAreaElement, StableTextAreaProps>(
  function StableTextArea(
    { value, onChange, onFocus, onBlur, disabled, readOnly, ...rest },
    ref,
  ) {
    const locked = Boolean(disabled || readOnly);
    const { draft, setDraft, focusProps } = useStableFieldDraft(value, locked);

    return (
      <textarea
        {...rest}
        ref={ref}
        value={draft}
        disabled={disabled}
        readOnly={readOnly}
        onChange={e => {
          const next = e.target.value;
          setDraft(next);
          onChange(next);
        }}
        onFocus={e => {
          focusProps.onFocus();
          onFocus?.(e);
        }}
        onBlur={e => {
          focusProps.onBlur();
          onBlur?.(e);
        }}
      />
    );
  },
);
