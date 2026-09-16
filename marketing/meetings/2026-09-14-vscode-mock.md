# Board — 14 Sep 2026 — VS Code CSS animation on the hero

**Status:** Executed. Autoplay frozen; VS Code chrome kept; tabs click-only.

**Roles (isolated):** [CMO](0e0aba70-12a5-41c0-bcfb-61ab96485948), [Product](dd6fbeca-3ed1-4d13-aa04-b6ced5c884e7), [Channel](5727b876-75b7-4711-966e-ebab1f5995a3), [Critic](9e33ee13-adc5-41d6-8128-4fb2f7ee05eb).

## Question

Is `HeroIllustration` (auto-cycling `api.mmt` / `test.mmt` / `suite.mmt` with fake Send / test / suite runs) good on the Show HN landing hero?

## Votes

| Role | Verdict |
|------|---------|
| CMO | CHANGE — keep VS Code chrome; freeze autoplay |
| Product | CHANGE — first fold is the copyable `echo.mmt`; mock fights that |
| Channel | CUT — HN treats fake Send as theater |
| Critic | CUT — this is the slot machine again, under a second YAML window |

## Agreement

- The try path is the static, copyable `echo.mmt` card.
- Auto-cycling tabs and fake runs compete with “YAML in Git you can paste.”
- Two YAML windows on first glance is too many.

## Dissent

- **CMO / Product:** do not delete the VS Code chrome; it is the “in VS Code” proof. Freeze or click-only tabs.
- **Channel / Critic:** delete the mock. A still or nothing.

## Decision (manager)

**CHANGE, not CUT.** Keep a VS Code-looking panel. Do not autoplay. Default freeze on the API tab. Tabs are click-only. Show finished request/response (and passed test/suite reports) on first paint. Do not loop Send / run.

Founder confirmed: execute the freeze.

## Kill list

- Auto-cycling tabs on the HN landing
- Fake cursor / delayed Send as the first frame
- Empty Response pane as the default API tab

## Executed

- More space in the split hero
- `echo.mmt` column capped (~22rem), not half the page
- Removed tab auto-cycle, particles, and intersection-observer replay
- First paint: `api.mmt` with request body + response body filled
- `test.mmt` / `suite.mmt` switch on click and show a completed report (Passed), not a running loop
