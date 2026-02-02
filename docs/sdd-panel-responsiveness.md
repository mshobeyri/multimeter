# SDD: Panel Responsiveness and Scrolling Fixes

## Problem Statement

After moving the edit section to a swipe view, several UI issues appeared:

1. **Minimum width too high**: All panels stop being responsive too early. UI should remain functional at 300px width (the minimum panel size from SplitPane).

2. **API panel height**: Works correctly - fixed height with internal scrolling in the second swipe tab.

3. **Suite and Test panels need vertical scroll**: Unlike API panel which has fixed height, Suite and Test panels should allow vertical scrolling of content.

## Root Cause Analysis

### Minimum Width Issue
- `.panel-box` had `min-width: 200px` but other elements had implicit min-widths
- Flex containers without `min-width: 0` cannot shrink below their content size
- Tab buttons and header elements have fixed widths that prevent shrinking

### Vertical Scroll Issue (Suite/Test)
- The swipe layout used `overflow: hidden` on `.api-swipe-page`
- For API panel, content is structured to fit within viewport with internal scrolling via `.apitest-section`
- For Suite and Test panels, content can grow beyond viewport height and needs the panel to scroll

## Solution

### Key CSS Changes

1. Add `min-width: 0` to all flex containers in the panel hierarchy to allow proper shrinking
2. Change `.api-swipe-page` from `overflow: hidden` to `overflow-x: hidden; overflow-y: auto` to allow vertical scrolling
3. Add `flex-wrap: wrap` to tab-bar and header-row for extreme narrow widths
4. Add text truncation to titles to prevent overflow

## Implementation (Completed)

### Changes to `/mmtview/src/App.css`

1. **`.panel`**: Changed `min-width: 100px` to `min-width: 0`

2. **`.panel-box`**: Changed `min-width: 200px` to `min-width: 0`

3. **`.api-swipe-root`**: Added `min-width: 0`

4. **`.api-swipe-track`**: Added `min-width: 0`

5. **`.api-swipe-page`**: Added `min-width: 0`, kept `overflow: hidden` (individual panels handle their own scroll)

6. **`.api-swipe-page--test`**: Added `min-width: 0`

7. **`.api-swipe-page--edit`**: Added `min-width: 0`

8. **`.apitest-panel-wrapper`** (both instances): Added `min-width: 0`

9. **`.apitest-root`**: Added `min-width: 0`

10. **`.apitest-section`**: Added `min-width: 0`

11. **`.tab-bar`**: Added `min-width: 0` and `flex-wrap: wrap`

12. **`.api-edit-header`**: Added `min-width: 0`

13. **`.api-edit-header-row`**: Added `min-width: 0` and `flex-wrap: wrap`

14. **`.api-edit-title`**: Added `min-width: 0`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`

15. **`.test-flow-tree`**: Added `min-width: 0`

16. **`.inner-box`**: Added `min-width: 0`

17. **`.tree-view-box`**: Reduced `min-height` and `max-height` from 48px to 36px, reduced padding and gap from 8px to 6px/4px, added `min-width: 0` for better responsiveness

### Changes to Panel Components

18. **`SuiteTest.tsx`**: Added `style={{ overflow: 'auto', flex: 1 }}` to panel-box for vertical scrolling

19. **`SuiteEdit.tsx`**: Added `style={{ overflow: 'auto', flex: 1 }}` to panel-box for vertical scrolling

20. **`SuitePanel.tsx`**: Added `overflow: 'hidden'` to wrapper div to contain scroll within SuiteTest

21. **`TestPanel.tsx`**: 
    - Added `overflow: "auto"` to test page wrapper
    - Wrapped edit page content in scrollable div with `style={{ flex: 1, minHeight: 0, overflow: "auto" }}`

## Testing

1. Resize panel to 300px width - all content should remain accessible
2. API panel: Height should be fixed, second tab should scroll internally
3. Suite panel: Content should scroll vertically when it exceeds viewport
4. Test panel: Content should scroll vertically when it exceeds viewport

## Notes

- The `SplitPane` component enforces `minSize={300}` so we don't need to support widths below 300px
- The swipe animation continues to work smoothly
- Tab icons collapse to icon-only mode at narrow widths (existing behavior preserved)
- API panel's internal scroll behavior is preserved because `.apitest-section` has its own `overflow-y: auto`
