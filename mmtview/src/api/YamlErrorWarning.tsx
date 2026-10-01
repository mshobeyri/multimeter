import React, {useContext, useEffect, useState} from 'react';
import {FileContext} from '../fileContext';
import {revealYamlEditorError, type YamlEditorError} from '../text/yamlEditorErrors';

function formatErrorLine(error: YamlEditorError): string {
  if (error.line) {
    return `Line ${error.line}: ${error.message}`;
  }
  return error.message;
}

/**
 * Full-pane YAML error report over a dimmed UI. Each black box is titled Error;
 * Restore/Keep sit under the last box. Click empty space to dismiss.
 */
export const YamlErrorDim: React.FC = () => {
  const {yamlErrors, yamlStale, restoreValidYaml, dismissYamlErrorDim, yamlErrorDimDismissed} =
    useContext(FileContext);
  const errors = yamlErrors || [];

  if (errors.length === 0 || yamlErrorDimDismissed) {
    return null;
  }

  const canRestore = Boolean(yamlStale && restoreValidYaml);

  return (
    <div
      className="mmt-yaml-error-dim"
      role="alert"
      aria-label="Error"
      onClick={() => dismissYamlErrorDim?.()}
    >
      <div className="mmt-yaml-error-dim-body">
        <ul className="mmt-yaml-error-dim-list">
          {errors.map((error, index) => (
            <li key={`${error.line ?? 0}:${error.column ?? 0}:${error.message}:${index}`}>
              <button
                type="button"
                className="mmt-yaml-error-dim-item"
                onClick={(e) => {
                  e.stopPropagation();
                  revealYamlEditorError(error);
                  dismissYamlErrorDim?.();
                }}
                title={error.line ? `Go to line ${error.line}` : undefined}
              >
                <span className="mmt-yaml-error-dim-item-title">
                  <span className="codicon codicon-error" aria-hidden />
                  <span>Error</span>
                </span>
                <span className="mmt-yaml-error-dim-item-msg">{formatErrorLine(error)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mmt-yaml-error-dim-actions">
          {canRestore ? (
            <button
              type="button"
              className="mmt-yaml-error-dim-link"
              onClick={(e) => {
                e.stopPropagation();
                restoreValidYaml?.();
              }}
            >
              Restore
            </button>
          ) : null}
          <button
            type="button"
            className="mmt-yaml-error-dim-link"
            onClick={(e) => {
              e.stopPropagation();
              dismissYamlErrorDim?.();
            }}
          >
            Keep
          </button>
        </div>
      </div>
    </div>
  );
};

const YamlErrorWarning: React.FC = () => {
  const {yamlErrors, yamlStale, restoreValidYaml} = useContext(FileContext);
  const [open, setOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const errors = yamlErrors || [];

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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (errors.length === 0) {
    return null;
  }

  const canRestore = Boolean(yamlStale && restoreValidYaml);

  return (
    <div className="unsaved-changes-anchor">
      <button
        ref={buttonRef}
        className="action-button api-edit-launcher yaml-error-btn"
        onClick={() => setOpen((v) => !v)}
        title="The YAML has errors"
        type="button"
      >
        <span className="codicon codicon-error" aria-hidden />
        <span className="api-edit-launcher-text">Error</span>
      </button>
      {open && (
        <div ref={popupRef} className="unsaved-changes-popup yaml-error-popup">
          <div className="unsaved-changes-popup-header">
            <span className="codicon codicon-error unsaved-changes-popup-icon yaml-error-popup-icon" aria-hidden />
            <span>Error</span>
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
            {yamlStale
              ? 'The YAML has errors, so this UI still shows the last valid version.'
              : 'The YAML has errors.'}
          </p>
          {canRestore && (
            <div className="unsaved-changes-popup-yaml-header">
              <div className="unsaved-changes-popup-actions">
                <button
                  className="button-icon"
                  onClick={() => {
                    restoreValidYaml?.();
                    setOpen(false);
                  }}
                  type="button"
                  title="Revert the YAML to the last valid version"
                >
                  <span className="codicon codicon-discard" aria-hidden /> Restore YAML
                </button>
              </div>
            </div>
          )}
          <ul className="yaml-error-list">
            {errors.map((error, index) => (
              <li key={`${error.line ?? 0}:${error.column ?? 0}:${error.message}:${index}`}>
                <button
                  className="yaml-error-item"
                  type="button"
                  onClick={() => {
                    revealYamlEditorError(error);
                    setOpen(false);
                  }}
                  title={error.line ? `Go to line ${error.line}` : undefined}
                >
                  {formatErrorLine(error)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Hide children while YAML errors are present (e.g. Send, export). */
export function HideWhenYamlError({children}: {children: React.ReactNode}) {
  const {yamlErrors} = useContext(FileContext);
  if (yamlErrors && yamlErrors.length > 0) {
    return null;
  }
  return <>{children}</>;
}

export default YamlErrorWarning;
