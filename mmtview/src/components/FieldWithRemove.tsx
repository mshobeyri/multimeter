import React, { useRef } from "react";
import type {
  RuntimeTokenValueContext,
  TokenPreviewCacheScope,
} from "mmt-core/api-edit/apiBodyEdit";
import StableTextInput from "./StableTextInput";
import TokenFieldInput from "./TokenFieldInput";
import { KV_FIELD_ATTR } from "./kvFieldNav";

/** Blur a focused field inside the wrap so a parent value replace is adopted. */
function blurFocusedField(wrap: HTMLElement | null) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && wrap?.contains(active)) {
    active.blur();
  }
}

interface FieldWithRemoveProps {
  value: string;
  onChange: (v: string) => void;
  onRemovePressed: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Non-editable but visually normal (unlike disabled). */
  readOnly?: boolean;
  removable?: boolean;
  copyable?: boolean;
  /** Extract-as-output control inside the value field (response headers/cookies). */
  onExtractPressed?: () => void;
  /**
   * When set, always show a reset control (enabled via `resetEnabled`).
   * Used for API/Test Inputs to restore the resolved YAML/example baseline.
   */
  onResetPressed?: () => void;
  /** When `onResetPressed` is set: enable the reset control. */
  resetEnabled?: boolean;
  /** Opt into resolved/token dual-mode when the value contains tokens. */
  canContainToken?: boolean;
  valueContext?: RuntimeTokenValueContext;
  tokenCacheScope?: TokenPreviewCacheScope;
  /** YAML value type chip drawn inside the input on the right (e.g. number). */
  typeLabel?: string;
  /** Marks this control for KV/KSV Tab navigation (`data-mmt-kv-field`). */
  kvField?: string;
}

/** Padding / right offset so a type chip and trailing icon buttons don't overlap text. */
export function fieldTrailingLayout(options: {
  typeLabel?: string;
  buttonCount?: number;
}): { paddingRight: number; typeRight: number; typeText: string } {
  const typeText = options.typeLabel ? `(${options.typeLabel})` : "";
  const buttonCount = Math.max(0, options.buttonCount ?? 0);
  const buttonRight = 4 + buttonCount * 32;
  const typeWidth = typeText ? Math.ceil(typeText.length * 4.5) : 0;
  const typeRight = buttonRight;
  return {
    typeText,
    paddingRight: typeText
      ? typeRight + typeWidth + 4
      : buttonCount > 0
        ? buttonRight
        : 8,
    typeRight,
  };
}

const FieldWithRemove: React.FC<FieldWithRemoveProps> = ({
  value,
  onChange,
  onRemovePressed,
  onBlur,
  onEnter,
  placeholder,
  disabled = false,
  readOnly = false,
  removable = true,
  copyable = false,
  onExtractPressed,
  onResetPressed,
  resetEnabled = false,
  canContainToken = false,
  valueContext,
  tokenCacheScope,
  typeLabel,
  kvField,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const extractable = typeof onExtractPressed === "function";
  const resettable = typeof onResetPressed === "function";
  const buttonCount =
    (removable ? 1 : 0)
    + (resettable ? 1 : 0)
    + (extractable ? 1 : 0)
    + (copyable && value ? 1 : 0);
  const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
    typeLabel,
    buttonCount,
  });
  const kvAttr = kvField
    ? { [KV_FIELD_ATTR]: kvField } as Record<string, string>
    : undefined;
  const wrapClass = [
    "field-with-remove",
    disabled ? "is-disabled" : "",
    removable ? "has-remove" : "",
    resettable ? "has-reset" : "",
    extractable ? "has-extract" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapClass} ref={wrapRef}>
      {canContainToken && !disabled && !readOnly ? (
        <TokenFieldInput
          value={value}
          canContainToken
          valueContext={valueContext}
          tokenCacheScope={tokenCacheScope}
          placeholder={placeholder}
          style={{ paddingRight }}
          {...kvAttr}
          onCommit={next => {
            onChange(next);
            onBlur?.();
          }}
          onDraftChange={onChange}
          onKeyDown={e => {
            if (e.key === "Enter") {
              onEnter?.();
            }
          }}
        />
      ) : (
        <StableTextInput
          type="text"
          value={value}
          placeholder={placeholder}
          style={{ paddingRight }}
          {...kvAttr}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          disabled={disabled}
          readOnly={readOnly}
        />
      )}
      {typeText ? (
        <span className="field-type-affix" style={{ right: typeRight }} title="Value type">
          {typeText}
        </span>
      ) : null}
      {copyable && value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => navigator.clipboard.writeText(value).catch(() => {})}
          title="Copy value"
          className="field-button is-copy"
        >
          <span className="action-button codicon codicon-copy" />
        </button>
      )}
      {extractable && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={event => event.preventDefault()}
          onClick={onExtractPressed}
          title="Extract as output"
          aria-label="Extract as output"
          className="field-button is-extract"
        >
          <span className="codicon codicon-sign-out" aria-hidden />
        </button>
      )}
      {resettable && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            // Drop focus first: stable/token drafts ignore parent updates while
            // focused, so reset would otherwise need a second click to show.
            blurFocusedField(wrapRef.current);
            onResetPressed?.();
          }}
          title="Reset to default"
          aria-label="Reset to default"
          disabled={disabled || readOnly || !resetEnabled}
          className="field-button is-reset"
        >
          <span className="action-button codicon codicon-discard" aria-hidden />
        </button>
      )}
      {removable && <button
        type="button"
        tabIndex={-1}
        onClick={onRemovePressed}
        title="Remove field"
        disabled={disabled || readOnly}
        className="field-button is-remove"
      >
        <span className="action-button codicon codicon-close" />
      </button>}
    </div>
  );
};

export default FieldWithRemove;
