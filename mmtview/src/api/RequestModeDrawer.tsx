import React, { useEffect, useRef, useState } from "react";
import SandboxIcon from "../icons/SandboxIcon";

export type RequestViewMode = "edit" | "telescope" | "sandbox";

const MODE_OPTIONS: Array<{
  mode: RequestViewMode;
  icon?: string;
  label: string;
  title: string;
  customIcon?: "sandbox";
}> = [
  {
    mode: "edit",
    icon: "codicon-edit-code",
    label: "Edit",
    title: "Edit mode — edit tokens; changes write to YAML",
  },
  {
    mode: "telescope",
    icon: "codicon-telescope",
    label: "Telescope",
    title: "Telescope — show resolved values; edits write tokens to YAML",
  },
  {
    mode: "sandbox",
    customIcon: "sandbox",
    label: "Sandbox",
    title: "Sandbox — edit resolved values for Send; YAML is not changed",
  },
];

function ModeGlyph({
  option,
}: {
  option: (typeof MODE_OPTIONS)[number];
}) {
  if (option.customIcon === "sandbox") {
    return <SandboxIcon className="apitest-mode-custom-icon" />;
  }
  return <span className={`codicon ${option.icon}`} aria-hidden />;
}

export function requestViewModeLabel(mode: RequestViewMode): string {
  return MODE_OPTIONS.find((item) => item.mode === mode)?.label ?? mode;
}

interface RequestModeDrawerProps {
  mode: RequestViewMode;
  onChange: (mode: RequestViewMode) => void;
}

/**
 * Collapsed: current mode icon. Click expands horizontally to pick Edit /
 * Telescope / Sandbox; choosing a mode collapses back to that icon.
 */
const RequestModeDrawer: React.FC<RequestModeDrawerProps> = ({
  mode,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = MODE_OPTIONS.find((item) => item.mode === mode) ?? MODE_OPTIONS[0];

  return (
    <div
      ref={rootRef}
      className={`apitest-mode-drawer${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className={`button-icon no-shrink section-edit-toggle apitest-header-tool-btn apitest-mode-drawer-current${
          mode !== "edit" ? " is-active" : ""
        }`}
        aria-label={current.label}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={open ? "Choose request mode" : current.title}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((prev) => !prev)}
      >
        <ModeGlyph option={current} />
      </button>
      <div
        className="apitest-mode-drawer-panel"
        role="listbox"
        aria-label="Request mode"
        aria-hidden={!open}
      >
        {MODE_OPTIONS.map((item) => {
          const selected = item.mode === mode;
          return (
            <button
              key={item.mode}
              type="button"
              role="option"
              aria-selected={selected}
              className={`button-icon no-shrink section-edit-toggle apitest-header-tool-btn apitest-mode-drawer-option${
                selected ? " is-active" : ""
              }`}
              title={item.title}
              aria-label={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                if (item.mode !== mode) {
                  onChange(item.mode);
                }
              }}
            >
              <ModeGlyph option={item} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RequestModeDrawer;
