import React from "react";
import type { BodyViewToolbarState } from "./BodyView";
import { useAccentChrome } from "../shared/useAccentChrome";
import { KebabMenu, type PopupMenuItem } from "./PopupMenu";

export function BodyViewValidationIndicator({
  toolbar,
}: {
  toolbar: BodyViewToolbarState | null;
}) {
  const invalid = Boolean(toolbar && !toolbar.isValid);

  return (
    <span
      className={`bodyview-header-error${invalid ? " is-invalid" : ""}`}
      title={toolbar?.errorMessage || "Invalid body"}
      role={invalid ? "status" : undefined}
      aria-label={invalid ? toolbar?.errorMessage || "Invalid body" : undefined}
      aria-hidden={!invalid}
    >
      <span className="codicon codicon-error" aria-hidden />
    </span>
  );
}

type BodyViewToolbarControlsProps = {
  toolbar: BodyViewToolbarState | null;
  compact?: boolean;
};

const BodyViewToolbarControls: React.FC<BodyViewToolbarControlsProps> = ({
  toolbar,
  compact = false,
}) => {
  const applyChrome = useAccentChrome("green");

  if (!toolbar) {
    return null;
  }

  if (compact) {
    const items: PopupMenuItem[] = [
      ...(toolbar.canBeautify
        ? [{ label: "Beautify", icon: "codicon-wand", onClick: toolbar.beautify }]
        : []),
      ...(toolbar.canApply
        ? [{ label: "Apply", onClick: toolbar.apply }]
        : []),
    ];
    return (
      <KebabMenu
        items={items.length > 0
          ? items
          : [{ label: "No actions available", onClick: () => {}, disabled: true }]}
        className="bodyview-header-kebab"
        menuClassName="popup-menu bodyview-header-menu"
      />
    );
  }

  return (
    <div className="bodyview-header-actions">
      {toolbar.canBeautify ? (
        <button
          type="button"
          className="button-icon no-shrink section-edit-toggle"
          title="Beautify"
          aria-label="Beautify body"
          onMouseDown={event => event.preventDefault()}
          onClick={toolbar.beautify}
        >
          <span className="codicon codicon-wand" aria-hidden />
        </button>
      ) : null}
      {toolbar.canApply ? (
        <button
          type="button"
          className="bodyview-btn bodyview-btn-apply"
          style={{
            background: applyChrome.fill,
            color: applyChrome.onFill,
            border: `1px solid ${applyChrome.border}`,
          }}
          onMouseDown={event => event.preventDefault()}
          onClick={toolbar.apply}
        >
          Apply
        </button>
      ) : null}
    </div>
  );
};

export default BodyViewToolbarControls;
