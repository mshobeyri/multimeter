import React, { useEffect, useRef, useState } from "react";
import ParkedYamlDiff from "./ParkedYamlDiff";

interface UnsavedChangesWarningProps {
  /** Current file / applied YAML (left / original side of the diff). */
  originalYaml: string;
  /** YAML with the user's temporary UI edits merged in. */
  modifiedYaml: string;
  onSave: () => void;
  onReset: () => void;
  /** When false, hide the UNSAVED CHANGES button but keep DiffEditor mounted. */
  showLauncher?: boolean;
  /** Fired once the DiffEditor has been created (so the parent can keep us mounted). */
  onDiffParked?: () => void;
}

const UnsavedChangesWarning: React.FC<UnsavedChangesWarningProps> = ({
  originalYaml,
  modifiedYaml,
  onSave,
  onReset,
  showLauncher = true,
  onDiffParked,
}) => {
  const [open, setOpen] = useState(false);
  // Keep Diff host mounted after first open — disposing Monaco DiffEditor
  // breaks the YAML editor's context menu / undo stack.
  const [diffMounted, setDiffMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const openPopup = () => {
    setDiffMounted(true);
    onDiffParked?.();
    setOpen(true);
  };

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
      {showLauncher ? (
        <button
          ref={buttonRef}
          className="action-button api-edit-launcher unsaved-warning-btn"
          onClick={() => (open ? setOpen(false) : openPopup())}
          title="The UI has unsaved changes"
          type="button"
        >
          <span className="codicon codicon-warning" aria-hidden />
          <span className="api-edit-launcher-text">UNSAVED CHANGES</span>
        </button>
      ) : null}
      {diffMounted ? (
        <div
          ref={popupRef}
          className="unsaved-changes-popup"
          // Keep real layout size while closed — display:none zeros Monaco and
          // breaks hideUnchangedRegions / wrap. Never reparent the editor DOM.
          style={
            open
              ? undefined
              : {
                  position: "fixed",
                  left: -10000,
                  top: 0,
                  visibility: "hidden",
                  pointerEvents: "none",
                }
          }
        >
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
            The UI is temporary. It contains the following unsaved changes.
          </p>
          <div className="unsaved-changes-popup-yaml-header">
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
          <div className="unsaved-changes-popup-diff">
            <ParkedYamlDiff
              original={originalYaml}
              modified={modifiedYaml}
              visible={open}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UnsavedChangesWarning;
