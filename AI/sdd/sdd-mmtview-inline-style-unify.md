# SDD: mmtview inline-style unification

Finish the leftover `mmtview` layout unification. HTML `res/` panels stay out. Work continues until every item below is done and `npm run compile --silent` is clean.

## Scope

Replace repeated static `style={{ }}` in `mmtview/src` with shared `App.css` classes (then split that stylesheet). Dynamic values stay inline.

## Stay inline

- Swipe `transform`
- Flowchart / portal / menu coordinates
- Computed `paddingRight` / `right` on field buttons
- Theme accent fills (`themeAccent`, `themeTick`, method colors, status-icon colors)
- HTML `res/` panels

## Done already

- [x] Shared form layout classes
- [x] Field primitives + env/test/variable forms
- [x] Panel shells (fill / page / scroll)
- [x] LoadTestEdit, MockServerSettings, ComboTable, TestIf

## Remaining

- [ ] Suite trees (edit + test rows, arrows, drop lines)
- [ ] SuiteEdit / SuiteTest leftover form and overview chrome
- [ ] Mock endpoint list + endpoint box form rows
- [ ] Reports: TestStepReportPanel, ReportPanel leftover, LoadTestReport, OverviewBoxes
- [ ] Remaining editors: SearchableTagInput static chrome, DescriptionEditor, DocOverview/Edit, EnvironmentView, TestFlow/TestFlowBox static chrome, TestTest, ViewSelector
- [ ] Split `App.css` by feature (`styles/`) so `App.tsx` imports the pieces; `res/` untouched

## Success

- Remaining `style={{ }}` in `mmtview/src` are only the stay-inline cases above
- No visual redesign; same layout via classes
- Compile passes after each slice
- Commits keep going; no review gate

## Order

1. Tree + suite forms
2. Mock endpoints / boxes
3. Reports
4. Leftover editors
5. Split `App.css`
