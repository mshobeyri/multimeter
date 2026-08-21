import React, { useEffect, useRef, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { defineTheme, getMonacoThemeName } from "../text/Theme";

interface UnsavedChangesWarningProps {
  /** Current file / applied YAML (left / original side of the diff). */
  originalYaml: string;
  /** YAML with the user's temporary UI edits merged in. */
  modifiedYaml: string;
  onSave: () => void;
  onReset: () => void;
}

const UnsavedChangesWarning: React.FC<UnsavedChangesWarningProps> = ({
  originalYaml,
  modifiedYaml,
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
    <div className="unsaved-changes-anchor">
      <button
        ref={buttonRef}
        className="action-button api-edit-launcher unsaved-warning-btn"
        onClick={() => setOpen(v => !v)}
        title="The UI has unsaved changes"
        type="button"
      >
        <span className="codicon codicon-warning" aria-hidden />
        <span className="api-edit-launcher-text">UNSAVED CHANGES</span>
      </button>
      {open && (
        <div ref={popupRef} className="unsaved-changes-popup">
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
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button
                className="button-icon"
                onClick={() => { onSave(); setOpen(false); }}
                type="button"
                title="Write UI edits into the YAML"
              >
                <span className="codicon codicon-save" aria-hidden /> Save to YAML
              </button>
              <button
                className="button-icon"
                onClick={() => { onReset(); setOpen(false); }}
                type="button"
                title="Discard UI changes"
              >
                <span className="codicon codicon-discard" aria-hidden /> Discard
              </button>
            </div>
          </div>
          <div className="unsaved-changes-popup-diff">
            <DiffEditor
              original={originalYaml}
              modified={modifiedYaml}
              language="yaml"
              theme={getMonacoThemeName()}
              beforeMount={defineTheme}
              height="240px"
              options={{
                readOnly: true,
                renderSideBySide: false,
                hideUnchangedRegions: {
                  enabled: true,
                  contextLineCount: 1,
                  minimumLineCount: 3,
                  revealLineCount: 20,
                },
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: "off",
                glyphMargin: false,
                folding: false,
                renderOverviewRuler: false,
                overviewRulerLanes: 0,
                scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
                renderIndicators: true,
                ignoreTrimWhitespace: false,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UnsavedChangesWarning;
