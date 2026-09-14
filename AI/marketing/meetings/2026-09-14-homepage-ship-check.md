# Board — 14 Sep 2026 — Homepage ship check (post-commit)

**Status:** Checked. Unanimous CHANGE. Not executed. Founder still chooses.

**Roles (isolated):** [CMO](cc4c1996-11fc-4396-9f46-9843abd81649), [Product](83e117fc-83a7-4f78-a389-4d9f3981a71a), [Channel](27b34af4-6210-4bcc-b0eb-c5d02ddc2bbf), [Critic](bda849a0-7599-4383-ae40-4dca919678b3).

**Commit:** `a6b5a35d` on `dev` — *Align the homepage with Git-native Show HN positioning.* Live `mmt.dev` was still the old page at check time.

## Question

Is the committed homepage KEEP for Show HN (Tue 15 Sep, URL `https://mmt.dev`)?

## Votes

| Role | Verdict |
|------|---------|
| CMO | CHANGE — first fold KEEP; strip leftover kill-list below |
| Product | CHANGE — true pitch; false comparison/FAQ/CLI/Azure/AI mock |
| Channel | CHANGE — keep URL; Copy echo-only before submit |
| Critic | CHANGE — Copy on test.mmt, fake Send, Promptfoo/JMeter/AI leftovers |

## Agreement

- First fold matches the Show HN first comment: Git-native H1, YAML-in-Git sentence, six-line `echo.mmt` against `https://test.mmt.dev/echo`, Apache / no account, Install.
- Do not CUT the illustrator the night before. Two YAML windows are already gone.
- Copy on `test.mmt` is the shared must-fix. Suite without Copy is correct. Default try path is echo only.
- Comparison table size (Postman / Bruno / REST Client) is the right below-fold set.
- Deploy this commit (plus any CHANGE) before submit; do not judge live `mmt.dev` as this work.

## Dissent

- **Channel:** only Copy echo-only is blocking. Features/CTA/AI below the fold are not the click path.
- **CMO:** also cut Promptfoo FAQ, JMeter line, Load Testing (Beta); demote AI cards; rewrite CTA. Do not freeze the whole homepage.
- **Product:** comparison “VS Code editor” cells are false (Postman and Bruno have VS Code apps). FAQ “nothing is ever sent to external servers” is false. `npx mmt-testlight run` is the wrong bin. Azure on the launch surface. Copilot Chat illustration is the deprecated generation story. Echo JSON is the right *shape*, not the live body (`timestamp` + full headers omitted).
- **Critic:** the 620px mock with a Send that does nothing is still the bounce. Decorative 200 / 142ms is frozen theater, not autoplay.

## Decision (pending founder)

Default if no override: **CHANGE, then deploy.** Copy only on `echo.mmt`. Do not rewrite the hero. Do not CUT chrome tonight.

## Kill list still on the page

- Copy footer on `test.mmt` (`HeroIllustration.tsx` `showFooter` for api **or** test)
- FAQ “like Promptfoo?” (`faq.ts`)
- JMeter name-drop (`BuiltForVSCode.tsx`)
- Features AI cards + `AITestGen` / `AIIllustration` Copilot-Chat typing theater
- JSON-LD electrical-meter disambiguation + AI `featureList` (`index.html`)
- CTA “simplify API testing”

## Still the founder’s job

- Choose KEEP as-shipped vs CHANGE (echo-only Copy ± below-fold strip)
- Deploy to `mmt.dev` before Tue 15 Sep submit
- Submit Show HN; first comment from `drafts/show-hn-sep-2026.md`
