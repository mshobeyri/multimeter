import React from "react";

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
}) => (
  <span
    className={["codicon", icon, className].filter(Boolean).join(" ")}
    aria-hidden
    title={title}
    style={{ color }}
  />
);

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
