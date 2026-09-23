import React from "react";

/** Single indent step for nested tree rows (not cumulative per depth). */
export const TREE_DEPTH_OFFSET = 16;

/** @param baseDepth depth treated as the visual root (0 = indent from root row). */
export const treeDepthMarginLeft = (depth: number, baseDepth = 1): number =>
  depth > baseDepth ? TREE_DEPTH_OFFSET : 0;

export const treeDragBetweenLineStyle = (
  lineStyle: React.CSSProperties | undefined,
  draggingDepth: number,
  baseDepth = 1,
): React.CSSProperties => ({
  ...(lineStyle || {}),
  left: `${treeDepthMarginLeft(draggingDepth, baseDepth)}px`,
});

type TreeDepthContainerProps = {
  context: { itemContainerWithChildrenProps?: React.HTMLAttributes<HTMLDivElement> };
  depth: number;
  /** Suite trees use 0 so groups at depth 1 indent; flow trees use 1 so top steps stay flush. */
  baseDepth?: number;
  children: React.ReactNode;
};

export const TreeDepthContainer: React.FC<TreeDepthContainerProps> = ({
  context,
  depth,
  baseDepth = 1,
  children,
}) => {
  const containerProps = (context.itemContainerWithChildrenProps || {}) as React.HTMLAttributes<HTMLDivElement>;
  const marginLeft = treeDepthMarginLeft(depth, baseDepth);
  const style: React.CSSProperties | undefined = marginLeft > 0
    ? { ...(containerProps.style || {}), marginLeft }
    : containerProps.style;

  return (
    <div {...containerProps} style={style}>
      {children}
    </div>
  );
};

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
