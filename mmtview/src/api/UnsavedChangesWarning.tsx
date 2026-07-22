import React, { useEffect, useRef, useState } from "react";

interface UnsavedChangesWarningProps {
  /** YAML representation with the user's temporary edits merged in. */
  modifiedYaml: string;
  /** Label above the YAML preview (e.g. "Modified API"). */
  yamlHeaderLabel?: string;
  onSave: () => void;
  onReset: () => void;
}

const UnsavedChangesWarning: React.FC<UnsavedChangesWarningProps> = ({
  modifiedYaml,
  yamlHeaderLabel = "Modified API",
  onSave,
  onReset,
}) => {
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
        title="YAML auto-sync paused — temporary UI changes"
        type="button"
      >
        <span className="codicon codicon-sync-ignored" aria-hidden />
      </button>
      {open && (
        <div ref={popupRef} className="unsaved-changes-popup">
          <div className="unsaved-changes-popup-header">
            <span className="codicon codicon-sync-ignored unsaved-changes-popup-icon" aria-hidden />
            <span>YAML auto-sync paused</span>
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
            Auto-sync from YAML to the UI is disabled because you have temporary
            changes. Update YAML to write them to the file, or Reset to YAML to
            discard them and resume syncing.
          </p>
          <div className="unsaved-changes-popup-yaml-header">
            <span>{yamlHeaderLabel}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="button-icon"
                onClick={() => { onSave(); setOpen(false); }}
                type="button"
                title="Update YAML with temporary UI changes"
              >
                <span className="codicon codicon-reply" aria-hidden /> Update YAML
              </button>
              <button
                className="button-icon"
                onClick={() => { onReset(); setOpen(false); }}
                type="button"
                title="Reset UI to the current YAML file"
              >
                <span className="codicon codicon-forward" aria-hidden /> Reset to YAML
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
