import React from "react";
import {
  formatOsEnvRef,
  isOsEnvRefValue,
  osEnvNameOfRef,
} from "mmt-core/env/envStore";

export function isOsEnvRefDisplayValue(value: unknown): value is string {
  return typeof value === 'string' && isOsEnvRefValue(value);
}

/** `$VAR` value with a read-only `(os)` chip (resolved from process env at run). */
export const EnvOsRefValue: React.FC<{ value: string }> = ({ value }) => {
  const ref = formatOsEnvRef(value);
  const osName = osEnvNameOfRef(ref) || ref.replace(/^\$/, "");
  return (
    <div className="field-with-remove environment-file-path-field has-live-chip">
      <input
        type="text"
        className="file-picker-input"
        value={ref}
        readOnly
        title={`OS environment variable ${osName}`}
        onFocus={event => event.currentTarget.select()}
      />
      <span
        className="field-type-affix is-live"
        title={`Reads process env ${osName} at run time`}
        aria-label="OS environment variable"
      >
        (os)
      </span>
    </div>
  );
};
