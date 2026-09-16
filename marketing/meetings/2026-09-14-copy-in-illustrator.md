# Board — 14 Sep 2026 — Copy into the VS Code illustrator?

**Status:** Executed. Founder overrode the default CUT: merge try path into the illustrator, drop the echo card, center the pitch.

**Roles (isolated):** [CMO](ae21e5dd-2eee-40fd-bf37-cecbec1a94e5), [Product](5224fb4e-1124-4048-aee0-1cc0f4422d7a), [Channel](802e5cf2-9a33-48a3-85be-a7b922f9d939), [Critic](e1bfac6c-c170-405c-82a8-258bbc843b68).

## Question

Move “copy and test yourself” into `HeroIllustration` and kill the separate `echo.mmt` card?

## Votes

| Role | Verdict |
|------|---------|
| CMO | CHANGE — merge; one real echo YAML with Copy inside VS Code chrome |
| Product | CUT illustrator — keep the small echo card as the only first-fold YAML |
| Channel | CUT illustrator — merge is worse than two windows |
| Critic | CHANGE, not the founder’s merge — cut the mock from the first fold; keep the echo card |

## Agreement

- Two YAML windows is still a fail.
- The try path is a stealable `echo.mmt` against `https://test.mmt.dev/echo`, matching the Show HN first comment.
- If the mock stays, its API YAML must be that same file — not `name: Multimeter` / `Hello from mmt!`.

## Dissent

- **CMO:** try path and “in VS Code” proof must be the same artifact. Kill the card, Copy on chrome, click-only tabs stay.
- **Product / Channel / Critic:** first fold is the file you steal. VS Code chrome on a mock trains “this is a screenshot.” Copy on `test.mmt` / `suite.mmt` is a worse first run than six-line echo. Channel: HN will assume framed YAML is a still and bounce.

## Decision (founder)

CMO merge, with the constraints from the board: Copy on `echo.mmt` only; those bytes are the live echo file; test/suite are not the paste target. Website colors stay; mock chrome follows real MMT UX (activity bar + editor tabs, tester tab strip, circular Send, overview boxes).

## Kill list

- Two YAML windows on the first fold
- Copying a different body than the first comment’s echo
- Copy on `test.mmt` / `suite.mmt` as the default try path
- Mac traffic-lights + “VS Code” wordmark crowding the file tabs
- Fake `{ body: { name, message } }` response (not what echo returns)

## Executed

- Removed the right-column `echo.mmt` card; hero copy is centered
- Copy lives on the illustrator `echo.mmt` tab; YAML is the Show HN snippet
- Response pane uses the real echo shape (`method`, `url`, `path`, `headers`, `body.message`)
- Activity bar holds the VS Code logo; file tabs are editor-style (`echo.mmt` / `test.mmt` / `suite.mmt`)
- API tester tabs: In / Out, Body, Params, Headers, Cookies, Doc; Send is the circular control
