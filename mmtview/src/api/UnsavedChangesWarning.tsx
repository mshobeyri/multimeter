import React, { useEffect, useRef, useState } from "react";

interface UnsavedChangesWarningProps {
  onSave: () => void;
  onReset: () => void;
}

const UnsavedChangesWarning: React.FC<UnsavedChangesWarningProps> = ({
  onSave,
  onReset,
}) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        !popupRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="unsaved-changes-anchor">
      <button
        ref={buttonRef}
        className="action-button api-edit-launcher unsaved-warning-btn"
        onClick={() => setOpen((prev) => !prev)}
        title="The UI has unsaved changes"
        type="button"
      >
        <span className="codicon codicon-warning" aria-hidden />
        <span className="api-edit-launcher-text">UNSAVED CHANGES</span>
      </button>
      {open ? (
        <div ref={popupRef} className="unsaved-changes-popup unsaved-changes-popup--simple">
          <div className="unsaved-changes-popup-header">
            <span className="codicon codicon-warning unsaved-changes-popup-icon" aria-hidden />
            <span>UNSAVED CHANGES</span>
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
            The UI is temporary. Save writes your edits into the YAML, or discard to restore.
          </p>
          <div className="unsaved-changes-popup-actions">
            <button
              className="button-icon"
              onClick={() => { setOpen(false); onSave(); }}
              type="button"
              title="Write UI edits into the YAML"
            >
              <span className="codicon codicon-save" aria-hidden /> Save to YAML
            </button>
            <button
              className="button-icon"
              onClick={() => { setOpen(false); onReset(); }}
              type="button"
              title="Discard UI changes"
            >
              <span className="codicon codicon-discard" aria-hidden /> Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UnsavedChangesWarning;
