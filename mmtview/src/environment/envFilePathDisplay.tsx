import React from "react";
import { openRelativeFile } from "../vsAPI";

/** Relative `./…mmt` path that becomes a file-backed env getter at run start. */
export function isEnvFilePathDisplayValue(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("./") && /\.mmt$/i.test(trimmed);
}

/** Path value with trailing open button (same chrome as FilePickerInput). */
export const EnvFilePathValue: React.FC<{ value: string }> = ({ value }) => {
  const path = value.trim();
  return (
    <div className="field-with-remove has-open environment-file-path-field">
      <input
        type="text"
        className="file-picker-input"
        value={path}
        readOnly
        title={path}
        onFocus={event => event.currentTarget.select()}
      />
      <button
        type="button"
        tabIndex={-1}
        className="field-button is-open"
        title="Open file"
        aria-label="Open file"
        onClick={() => openRelativeFile(path)}
      >
        <span className="action-button codicon codicon-symbol-method-arrow" />
      </button>
    </div>
  );
};
