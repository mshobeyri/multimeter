import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  enterEditStringBuffer,
  findDisplayTokenCharRanges,
  projectTokenFieldPreview,
  stringContainsFieldToken,
  type RuntimeTokenValueContext,
  type TokenFieldSpan,
} from "mmt-core/apiBodyEdit";

type TokenFieldInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "defaultValue"
> & {
  value: string;
  /**
   * When true, fields that actually contain tokens use resolved preview +
   * first-keystroke token edit + blur back to preview. Fields without tokens
   * stay normal inputs.
   */
  canContainToken?: boolean;
  /** Active inputs/env for resolving `{{i:}}` / `{{e:}}` in preview. */
  valueContext?: RuntimeTokenValueContext;
  onCommit: (value: string) => void;
  /** Live keystroke callback (optional; blur/Enter still commit). */
  onDraftChange?: (value: string) => void;
};

function renderHighlighted(
  text: string,
  spans: TokenFieldSpan[],
): React.ReactNode {
  if (!text) {
    return null;
  }
  if (spans.length === 0) {
    return text;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  spans.forEach((span, i) => {
    if (span.start < last || span.end <= span.start) {
      return;
    }
    if (span.start > last) {
      parts.push(text.slice(last, span.start));
    }
    parts.push(
      <span
        key={`${span.kind}-${span.start}-${i}`}
        className={
          span.kind === "resolved"
            ? "token-field-span is-resolved"
            : "token-field-span is-token"
        }
      >
        {text.slice(span.start, span.end)}
      </span>,
    );
    last = span.end;
  });
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

/**
 * Single-line field with optional token dual-mode (see `canContainToken`).
 * Commits on blur or Enter like BlurCommitInput.
 */
const TokenFieldInput: React.FC<TokenFieldInputProps> = ({
  value,
  canContainToken = false,
  valueContext,
  onCommit,
  onDraftChange,
  onFocus,
  onKeyDown,
  className,
  style,
  ...rest
}) => {
  const hasTokens = canContainToken && stringContainsFieldToken(value);
  const [draft, setDraft] = useState(value);
  const [tokenEdit, setTokenEdit] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mirrorStyle, setMirrorStyle] = useState<React.CSSProperties>({});
  const focusedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
      setTokenEdit(false);
    }
  }, [value]);

  const preview = useMemo(
    () => (hasTokens ? projectTokenFieldPreview(value, valueContext) : null),
    [hasTokens, value, valueContext],
  );

  const showPreview = hasTokens && !tokenEdit;
  const displayValue = showPreview ? (preview?.text ?? "") : draft;
  const highlightSpans = showPreview
    ? (preview?.spans ?? [])
    : findDisplayTokenCharRanges(draft);

  // Underline layer only when blurred — while focused the native input keeps a
  // visible caret / selection like a normal field.
  const useHighlightLayer = hasTokens && !focused;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || !useHighlightLayer) {
      return;
    }
    const cs = getComputedStyle(el);
    setMirrorStyle({
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      borderTopWidth: cs.borderTopWidth,
      borderRightWidth: cs.borderRightWidth,
      borderBottomWidth: cs.borderBottomWidth,
      borderLeftWidth: cs.borderLeftWidth,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      letterSpacing: cs.letterSpacing,
      lineHeight: cs.lineHeight,
      boxSizing: cs.boxSizing as React.CSSProperties["boxSizing"],
    });
  }, [useHighlightLayer, displayValue, className, style]);

  const commit = (next: string) => {
    onCommit(next);
  };

  const beginTokenEdit = (nextDraft: string) => {
    setTokenEdit(true);
    setDraft(nextDraft);
    onDraftChange?.(nextDraft);
  };

  return (
    <div
      className={`token-field${showPreview ? " is-preview" : ""}${
        tokenEdit ? " is-token-edit" : ""
      }${useHighlightLayer ? " has-highlights" : ""}`}
    >
      {useHighlightLayer ? (
        <div className="token-field-backdrop" style={mirrorStyle} aria-hidden>
          {renderHighlighted(displayValue, highlightSpans)}
        </div>
      ) : null}
      <input
        {...rest}
        ref={inputRef}
        style={style}
        className={[
          className,
          "token-field-input",
          showPreview ? "is-token-preview" : "",
          useHighlightLayer ? "is-highlight-overlay" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        value={displayValue}
        onChange={e => {
          const next = e.target.value;
          if (showPreview) {
            // First keystroke/paste: swap to token template (key consumed).
            const template = enterEditStringBuffer(
              preview?.text ?? "",
              next,
              value,
            );
            beginTokenEdit(template);
            return;
          }
          setDraft(next);
          onDraftChange?.(next);
        }}
        onFocus={e => {
          focusedRef.current = true;
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={() => {
          focusedRef.current = false;
          setFocused(false);
          if (showPreview) {
            // No edits — keep stored token template.
            setTokenEdit(false);
            return;
          }
          commit(draft);
          setTokenEdit(false);
        }}
        onKeyDown={e => {
          onKeyDown?.(e);
          if (e.defaultPrevented) {
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (!showPreview) {
              commit(draft);
            }
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
};

export default TokenFieldInput;
