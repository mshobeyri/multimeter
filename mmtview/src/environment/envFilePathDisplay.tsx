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

/** Path value with a clickable `(live)` chip that opens the backing file. */
export const EnvFilePathValue: React.FC<{ value: string }> = ({ value }) => {
  const path = value.trim();
  return (
    <div className="field-with-remove environment-file-path-field has-live-chip">
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
        className="field-type-affix is-live"
        title="Open live variable file"
        aria-label="Open live variable file"
        onClick={() => openRelativeFile(path)}
      >
        (live)
      </button>
    </div>
  );
};
