# SDD: mmtview UI Chrome Unification

## Problem Statement

`mmtview` panels (API, Test, Suite, Mock, Doc, Environment, LoadTest, Report) repeatedly hand-roll the same chrome:

1. **Tab bars** — identical `tab-button` loops, often with a duplicated `ResizeObserver` for icon-only collapse.
2. **Primary actions** — `button-icon` / “Add X” / Export / Run–Stop with the same markup and, in places, **inline VS Code button chrome** instead of shared CSS.
3. **Panel headers** — run-page title row (`tab-bar-single` + launchers) and edit-page row (back + title + tabs) copied across panels.
4. **Specialized controls** — `SendButton` and `ExportReportButton` already exist, but Export still inlines primary styles; Connect and doc Export are one-off twins.

Main panel files mix layout JSX with chrome markup, which makes theme fixes (borders, foreground, accents) hard to apply consistently and keeps panels looking like ad-hoc HTML rather than a product UI kit.

## Goals

- One shared **UI chrome kit** under `mmtview/src/components/` (and thin `shared/` helpers where needed).
- Panels declare **data** (tabs, actions, titles); they do not reimplement tab/button chrome.
- Visual tokens stay in `App.css` (VS Code CSS variables + existing classes); components compose those classes — no duplicated inline primary-button styles.
- Theme rules already established for accents/buttons remain the single source of truth (`themeAccent`, button tokens).

## Non-goals

- Redesigning the API tester Send/Connect interaction model in the first pass.
- Rewriting suite tree row run glyphs beyond stopping misuse of `tab-button` as a run control.
- Moving business logic out of panels (only chrome / layout composition).

## Target shared components

| Component | Responsibility | Replaces |
|-----------|----------------|----------|
| **`TabBar`** | Data-driven tabs; optional label collapse via `ResizeObserver` | Tab loops in API/Test/Mock/Doc/Env/SuiteEdit/LoadTestEdit; 4× collapse hooks |
| **`PrimaryButton`** | Icon + label primary CTA (`button` + `.button-icon`) | Add Example/Step/…, Doc Export, Env cache actions; cleans `ExportReportButton` |
| **`GhostButton` / keep `.action-button`** | Transparent icon/text actions | Edit launchers, back arrows (thin wrapper optional) |
| **`RunStopToggle`** | Idle Run vs Stop while running (+ optional context menu) | TestTest / SuiteTest / MockPanel run bars |
| **`PanelRunHeader`** | Title tab + right-side launcher slot(s) | Run-page headers across panels |
| **`PanelEditHeader`** | Back + title + optional `TabBar` children | Edit-page headers |
| **`ExportReportButton`** (tighten) | Format-picker export on top of `PrimaryButton` | Inline chrome inside current ExportReportButton |
| **`SendButton`** | Keep; no further extraction in this SDD | — |

## UX rules (chrome)

- **Primary filled buttons**: `--vscode-button-background` / `foreground` / `border` (border only when theme defines a distinct `button.border`).
- **Method / accent chips**: button-themed soft fill via `harmonizeAccent` (see themeAccent); not input/select borders.
- **Tabs**: existing `.tab-button` / `.tab-button-small` look; collapse labels under a shared width threshold (~350px).
- **Ghost actions**: `.action-button` — no filled background.

## Implementation order

1. **`TabBar`** (+ internal collapse) — migrate all panel tab bars; delete local `showIconsOnly` hooks.
2. **`PrimaryButton`** — migrate Add-* and Doc Export; refactor `ExportReportButton` to use it; remove dead `FlowchartButton` or point it at `PrimaryButton`.
3. **`RunStopToggle`** — Test / Suite / Mock.
4. **`PanelRunHeader`** then **`PanelEditHeader`** — strip header HTML from panels.
5. **Suite tree run control** — replace `tab-button` misuse with ghost/icon run control.

Each step is one (or a few) focused commits: introduce component → migrate call sites → delete dead duplication.

## File layout

```
mmtview/src/components/
  TabBar.tsx
  PrimaryButton.tsx
  RunStopToggle.tsx
  PanelRunHeader.tsx
  PanelEditHeader.tsx
  SendButton.tsx          # existing
  … 
mmtview/src/shared/
  ExportReportButton.tsx  # thin wrapper over PrimaryButton
```

## Success criteria

- No panel reimplements a tab strip or primary “Add …” button by hand.
- No inline copies of `button-background` / `button-foreground` / `button-border` outside the chrome kit (and Send’s accent path).
- Theme/button/accent fixes land in one place and apply everywhere.
- Panel JSX reads as composition: headers + `TabBar` + content regions.

## Out of scope follow-ups

- Unify `tab-button-small` (API tester body tabs) onto `TabBar` `variant="small"` once main tabs are done.
- ConnectButton accent parity with SendButton.
