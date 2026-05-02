import React, { useEffect, useRef, useState } from "react";

interface UnsavedChangesWarningProps {
  /** YAML representation of the API with the user's temporary edits merged in. */
  modifiedYaml: string;
  onSave: () => void;
  onDiscard: () => void;
}

const UnsavedChangesWarning: React.FC<UnsavedChangesWarningProps> = ({ modifiedYaml, onSave, onDiscard }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { return; }
    const handler = (e: MouseEvent) => {
      if (
        !popupRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="action-button unsaved-warning-btn"
        onClick={() => setOpen(v => !v)}
        title="These changes are temporary and won't be saved to the file"
        type="button"
      >
        <span className="codicon codicon-warning" aria-hidden />
      </button>
      {open && (
        <div ref={popupRef} className="unsaved-changes-popup">
          <div className="unsaved-changes-popup-header">
            <span className="codicon codicon-warning unsaved-changes-popup-icon" aria-hidden />
            <span>Temporary changes</span>
            <button
              className="unsaved-changes-popup-close"
              onClick={() => setOpen(false)}
              type="button"
              title="Close"
            >
              <span className="codicon codicon-close" aria-hidden />
            </button>
          </div>
          <p className="unsaved-changes-popup-desc">
            Modifications are temporary and won't be persisted to the file automatically.
          </p>
          <div className="unsaved-changes-popup-yaml-header">
            <span>Modified API</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="button-icon"
                onClick={() => { onSave(); setOpen(false); }}
                type="button"
                title="Save changes to file"
              >
                <span className="codicon codicon-save" aria-hidden /> Save
              </button>
              <button
                className="button-icon"
                onClick={() => { onDiscard(); setOpen(false); }}
                type="button"
                title="Discard changes and reset to file"
              >
                <span className="codicon codicon-discard" aria-hidden /> Discard
              </button>
            </div>
          </div>
          <pre className="unsaved-changes-popup-yaml">{modifiedYaml}</pre>
        </div>
      )}
    </div>
  );
};

export default UnsavedChangesWarning;
