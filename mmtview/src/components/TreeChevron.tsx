import React from "react";

type TreeChevronProps = {
  open: boolean;
  className?: string;
  muted?: boolean;
};

export const TreeChevron: React.FC<TreeChevronProps> = ({
  open,
  className,
  muted,
}) => (
  <span
    className={[
      "codicon",
      open ? "codicon-chevron-down" : "codicon-chevron-right",
      muted ? "muted" : className ? undefined : "tree-chevron",
      className,
    ].filter(Boolean).join(" ")}
  />
);

type TreeFolderArrowProps = {
  isFolder: boolean;
  isExpanded?: boolean;
  arrowProps?: React.HTMLAttributes<HTMLElement>;
  tall?: boolean;
  leaf?: React.ReactNode;
};

export const TreeFolderArrow: React.FC<TreeFolderArrowProps> = ({
  isFolder,
  isExpanded,
  arrowProps,
  tall,
  leaf,
}) => {
  if (!isFolder) {
    return <>{leaf ?? <span className="tree-arrow-spacer" />}</>;
  }
  const { className, ...rest } = arrowProps || {};
  return (
    <span
      {...rest}
      className={["tree-arrow", tall ? "is-tall" : undefined, className].filter(Boolean).join(" ")}
    >
      <TreeChevron open={!!isExpanded} />
    </span>
  );
};

type TreeExpandButtonProps = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

export const TreeExpandButton: React.FC<TreeExpandButtonProps> = ({
  open,
  onToggle,
  className = "test-flow-expand",
}) => (
  <button
    className={["action-button", className].filter(Boolean).join(" ")}
    type="button"
    title={open ? "Collapse box" : "Expand box"}
    aria-label={open ? "Collapse box" : "Expand box"}
    onPointerDown={e => e.stopPropagation()}
    onPointerUp={e => {
      e.stopPropagation();
      onToggle();
    }}
    onKeyDown={e => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    }}
    draggable={false}
    tabIndex={0}
  >
    <TreeChevron open={open} />
  </button>
);

export default TreeChevron;
