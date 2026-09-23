/**
 * Compare suite tree row props, ignoring closures that `renderItem` recreates
 * on every parent render (`onRun`, `context` object, `arrow`).
 */
export function areSuiteTreeRowPropsEqual<T extends {
  item?: { index?: unknown; isFolder?: boolean; data?: { childrenRangeLabel?: string } };
  context?: { isExpanded?: boolean };
  depth?: number;
  status?: unknown;
  displayPath?: string;
  stepReports?: unknown;
  missingFiles?: unknown;
  runDisabled?: boolean;
  children?: unknown;
  canShowStatusIcon?: boolean;
  showRunButton?: boolean;
  duplicateServer?: boolean;
  reportSpilled?: boolean;
  reportLoading?: boolean;
}>(prev: T, next: T): boolean {
  if (prev.item?.index !== next.item?.index) {
    return false;
  }
  const prevRange = (prev.item?.data as { childrenRangeLabel?: string } | undefined)?.childrenRangeLabel;
  const nextRange = (next.item?.data as { childrenRangeLabel?: string } | undefined)?.childrenRangeLabel;
  if (prevRange !== nextRange) {
    return false;
  }
  if (prev.depth !== next.depth) {
    return false;
  }
  if (prev.status !== next.status) {
    return false;
  }
  if (prev.displayPath !== next.displayPath) {
    return false;
  }
  if (prev.stepReports !== next.stepReports) {
    return false;
  }
  if (prev.context?.isExpanded !== next.context?.isExpanded) {
    return false;
  }
  if (prev.missingFiles !== next.missingFiles) {
    return false;
  }
  if (prev.runDisabled !== next.runDisabled) {
    return false;
  }
  if (prev.canShowStatusIcon !== next.canShowStatusIcon) {
    return false;
  }
  if (prev.showRunButton !== next.showRunButton) {
    return false;
  }
  if (prev.duplicateServer !== next.duplicateServer) {
    return false;
  }
  if (prev.reportSpilled !== next.reportSpilled) {
    return false;
  }
  if (prev.reportLoading !== next.reportLoading) {
    return false;
  }
  if (prev.item?.isFolder || next.item?.isFolder) {
    return prev.children === next.children;
  }
  return true;
}
