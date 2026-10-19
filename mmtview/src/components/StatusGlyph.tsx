import React from "react";

/** Custom status glyph id (not a codicon); rendered as SVG with a circle like play/stop. */
export const PAUSE_CIRCLE_ICON = "mmt-pause-circle";

/** Pause bars inside a circle — same ring geometry as codicon play-circle / stop-circle. */
export const PAUSE_CIRCLE_SVG =
  '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M8 1C4.14 1 1 4.14 1 8C1 11.86 4.14 15 8 15C11.86 15 15 11.86 15 8C15 4.14 11.86 1 8 1ZM8 14C4.691 14 2 11.309 2 8C2 4.691 4.691 2 8 2C11.309 2 14 4.691 14 8C14 11.309 11.309 14 8 14ZM6 5C5.44772 5 5 5.44772 5 6V10C5 10.5523 5.44772 11 6 11C6.55228 11 7 10.5523 7 10V6C7 5.44772 6.55228 5 6 5ZM10 5C9.44772 5 9 5.44772 9 6V10C9 10.5523 9.44772 11 10 11C10.5523 11 11 10.5523 11 10V6C11 5.44772 10.5523 5 10 5Z"/>' +
  "</svg>";

export type StatusGlyphMeta = {
  icon: string;
  color: string;
  title?: string;
};

type StatusGlyphProps = StatusGlyphMeta & {
  className?: string;
};

export const StatusGlyph: React.FC<StatusGlyphProps> = ({
  icon,
  color,
  title,
  className,
}) => {
  if (icon === PAUSE_CIRCLE_ICON) {
    // Match `.codicon[class*='codicon-']` fixed 16px so the circle matches pass/play/stop.
    return (
      <span
        className={["codicon", className].filter(Boolean).join(" ")}
        aria-hidden
        title={title}
        style={{
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
        dangerouslySetInnerHTML={{ __html: PAUSE_CIRCLE_SVG }}
      />
    );
  }
  return (
    <span
      className={["codicon", icon, className].filter(Boolean).join(" ")}
      aria-hidden
      title={title}
      style={{ color }}
    />
  );
};

export type SuiteKind = "test" | "server" | "suite" | "group" | "root";

const SUITE_KIND_META: Record<SuiteKind, { icon: string; title: string }> = {
  test: { icon: "codicon-beaker", title: "Test" },
  server: { icon: "codicon-server-environment", title: "Mock server" },
  suite: { icon: "codicon-layers", title: "Suite" },
  group: { icon: "codicon-collection", title: "Group" },
  root: { icon: "codicon-layers", title: "Suite" },
};

export const SuiteKindIcon: React.FC<{ kind: SuiteKind }> = ({ kind }) => {
  const meta = SUITE_KIND_META[kind];
  return (
    <span
      className={`codicon ${meta.icon} icon-fg`}
      aria-hidden
      title={meta.title}
    />
  );
};

export default StatusGlyph;
