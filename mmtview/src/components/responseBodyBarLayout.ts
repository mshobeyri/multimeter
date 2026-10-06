const MIN_INLINE_CONTROLS_WIDTH = 400;
const MIN_RESPONSE_TABS_WIDTH = 120;
const RESPONSE_ROW_SPACING = 32;
const RESPONSE_TOOLS_MAX_RATIO = 0.55;

export function shouldUseCompactResponseControls(
  rowWidth: number,
  metaWidth: number,
): boolean {
  const availableAfterTabs = rowWidth - metaWidth - MIN_RESPONSE_TABS_WIDTH - RESPONSE_ROW_SPACING;
  const maxToolsWidth = Math.min(rowWidth * RESPONSE_TOOLS_MAX_RATIO, availableAfterTabs);
  return maxToolsWidth < MIN_INLINE_CONTROLS_WIDTH;
}
