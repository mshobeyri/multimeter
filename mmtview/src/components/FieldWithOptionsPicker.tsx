import React, { useEffect, useRef, useState } from "react";
import { ParamConstraintOption } from "mmt-core/paramConstraints";
import { safeList } from "mmt-core/safer";
import { fieldTrailingLayout } from "./FieldWithRemove";
import StableTextInput from "./StableTextInput";
import { KV_FIELD_ATTR } from "./kvFieldNav";

interface FieldWithOptionsPickerProps {
  value: string;
  onChange: (v: string) => void;
  onPick?: (v: ParamConstraintOption["value"]) => void;
  onRemovePressed: () => void;
  options: ParamConstraintOption[];
  placeholder?: string;
  disabled?: boolean;
  removable?: boolean;
  copyable?: boolean;
  typeLabel?: string;
  kvField?: string;
}

const FieldWithOptionsPicker: React.FC<FieldWithOptionsPickerProps> = ({
  value,
  onChange,
  onPick,
  onRemovePressed,
  options,
  placeholder,
  disabled = false,
  removable = true,
  copyable = false,
  typeLabel,
  kvField,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const showPicker = options.length > 0;
  const buttonCount =
    (showPicker ? 1 : 0) + (removable ? 1 : 0) + (copyable && value ? 1 : 0);
  const { paddingRight, typeRight, typeText } = fieldTrailingLayout({
    typeLabel,
    buttonCount,
  });

  const pickerRight = (removable ? 28 : 4) + (copyable && value ? 24 : 0);

  return (
    <div
      ref={rootRef}
      className={`field-with-remove${disabled ? " is-disabled" : ""}${removable ? " has-remove" : ""}`}
    >
      <StableTextInput
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ paddingRight }}
        onChange={onChange}
        disabled={disabled}
        {...(kvField ? { [KV_FIELD_ATTR]: kvField } : {})}
      />
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
          style={{
            right: removable ? (showPicker ? 52 : 28) : showPicker ? 28 : 4,
          }}
          className="field-button is-copy"
        >
          <span className="action-button codicon codicon-copy" />
        </button>
      )}
      {showPicker && (
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setMenuOpen(open => !open)}
            title="Choose from listed options"
            disabled={disabled}
            style={{ right: pickerRight }}
            className="field-button"
          >
            <span className="action-button codicon codicon-ellipsis" />
          </button>
          {menuOpen && (
            <div role="listbox" className="field-picker-menu">
              {safeList(options).map(opt => (
                <button
                  key={`${opt.label}:${String(opt.value)}`}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={opt.label === value}
                  onClick={() => {
                    if (onPick) {
                      onPick(opt.value);
                    } else {
                      onChange(opt.label);
                    }
                    setMenuOpen(false);
                  }}
                  className={`field-picker-item${opt.label === value ? " is-selected" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {removable && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onRemovePressed}
          title="Remove field"
          disabled={disabled}
          className="field-button"
        >
          <span className="action-button codicon codicon-close" />
        </button>
      )}
    </div>
  );
};

export default FieldWithOptionsPicker;
