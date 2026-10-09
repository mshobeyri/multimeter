import React from "react";
import { openRelativeFile } from "../vsAPI";
import { isOpenFileModifier } from "../suite/test/suiteTreeLabelClick";

/** Relative `./…mmt` path that becomes a file-backed env getter at run start. */
export function isEnvFilePathDisplayValue(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("./") && /\.mmt$/i.test(trimmed);
}

/** Underlined, Ctrl/Cmd+clickable path for file-backed env values. */
export const EnvFilePathValue: React.FC<{ value: string }> = ({ value }) => {
  const path = value.trim();
  return (
    <span
      className="environment-file-path"
      title={`${path}\nCtrl/Cmd+click to open`}
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (!isOpenFileModifier(event)) {
          return;
        }
        event.preventDefault();
        openRelativeFile(path);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !isOpenFileModifier(event)) {
          return;
        }
        event.preventDefault();
        openRelativeFile(path);
      }}
    >
      {path}
    </span>
  );
};
