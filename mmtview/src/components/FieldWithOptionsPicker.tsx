import React, { useEffect, useRef, useState } from "react";
import { ParamConstraintOption } from "mmt-core/paramConstraints";
import { safeList } from "mmt-core/safer";

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
  const buttonCount = (showPicker ? 1 : 0) + (removable ? 1 : 0) + (copyable ? 1 : 0);
  const paddingRight = buttonCount > 0 ? 12 + buttonCount * 24 : 36;

  const pickerRight = (removable ? 28 : 4) + (copyable ? 24 : 0);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{
          width: "100%",
          verticalAlign: "top",
          cursor: disabled ? "not-allowed" : undefined,
          paddingRight,
        }}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
      {copyable && value && (
        <button
          onClick={() => navigator.clipboard.writeText(value).catch(() => {})}
          title="Copy value"
          style={{
            position: "absolute",
            right: removable ? (showPicker ? 52 : 28) : showPicker ? 28 : 4,
            top: "50%",
            transform: "translateY(-50%)",
          }}
          className="field-button"
        >
          <span className="action-button codicon codicon-copy" style={{ fontSize: "16px" }} />
        </button>
      )}
      {showPicker && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            title="Choose from listed options"
            disabled={disabled}
            style={{
              position: "absolute",
              right: pickerRight,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            className="field-button"
          >
            <span className="action-button codicon codicon-ellipsis" style={{ fontSize: "16px" }} />
          </button>
          {menuOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 2,
                zIndex: 20,
                minWidth: 120,
                maxWidth: "100%",
                maxHeight: 200,
                overflowY: "auto",
                background: "var(--vscode-dropdown-background, #3c3c3c)",
                border: "1px solid var(--vscode-dropdown-border, #454545)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              }}
            >
              {safeList(options).map(opt => (
                <button
                  key={`${opt.label}:${String(opt.value)}`}
                  type="button"
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
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    border: "none",
                    background: opt.label === value
                      ? "var(--vscode-list-activeSelectionBackground, #094771)"
                      : "transparent",
                    color: "var(--vscode-dropdown-foreground, #cccccc)",
                    cursor: "pointer",
                  }}
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
          onClick={onRemovePressed}
          title="Remove field"
          disabled={disabled}
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
          className="field-button"
        >
          <span className="action-button codicon codicon-close" style={{ fontSize: "16px" }} />
        </button>
      )}
    </div>
  );
};

export default FieldWithOptionsPicker;
