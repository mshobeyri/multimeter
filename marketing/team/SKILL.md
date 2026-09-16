---
name: marketing-team
description: Multimeter marketing board process — CMO, Product, Channel, Critic roles, meeting memos, and how to run planning sessions. Use when the user asks for a marketing board, CMO vote, channel strategy meeting, meeting memo, or how the marketing team decides and records outcomes.
---

# Marketing team (board)

Internal marketing decisions use an isolated four-role board. Roles argue separately, then merge. Do not collapse them into one voice mid-meeting.

## Roles

| Role | Job |
|------|-----|
| **CMO** | Positioning, first-fold story, what the product promises. Decides KEEP / CHANGE / CUT for messaging and hero. |
| **Product** | What is true in the product today. Blocks claims the build cannot back. |
| **Channel** | Where and how we publish (HN, LinkedIn, Marketplace, demo). Timing, format, channel norms. |
| **Critic** | Kill list. Cuts theater, lottery distribution, and claims that bounce. |

When spawning isolated agents for a board, label each role and keep their votes in a table before the merge.

## How to run a meeting

1. Read recent memos in `marketing/meetings/` before proposing a new plan.
2. State one question. Do not smuggle three decisions into one memo.
3. Collect each role’s vote: KEEP / CHANGE / CUT (or Agree / Dissent).
4. Record dissent explicitly. Silence is not agreement.
5. Write a single Decision, a Kill list, and an Execute list (who does what next).
6. Save the memo as `marketing/meetings/YYYY-MM-DD-slug.md`.

## Memo template

```markdown
# Board — DD Mon YYYY — <short title>

**Status:** Decided. | Open. | CMO vote only. Not executed.

**Roles (isolated):** CMO, Product, Channel, Critic.

## Question

<one question>

## Votes (optional table)

| Role | Vote |
|------|------|
| CMO | … |
| Product | … |
| Channel | … |
| Critic | … |

## Agreement

- …

## Dissent

- **Channel:** …
- **Critic:** …
- **CMO / Product:** …

## Decision

<one clear decision>

## Kill list

- …

## Execute

1. …
```

## How to create posts

Post and upload copy is not decided in the board memo. After the board picks the channel and angle:

| Channel | Skill |
|---------|--------|
| LinkedIn / social / launch post | `marketing/linkedin/SKILL.md` |
| YouTube title, description, tags | `marketing/youtube/SKILL.md` |
| Hacker News / Show HN | `marketing/hacker-news/SKILL.md` |

Drafts for live launches live in `marketing/drafts/`. Update the draft in place when facts change (demo URL, Marketplace title, CTAs).

## Standing rules (from prior boards)

- Read `marketing/meetings/` before restarting a parked channel.
- HN is parked after the Sep 2026 flagged Show HN — see `2026-09-15-hn-flagged-park.md` and `2026-09-15-next-after-hn.md`.
- Organic LinkedIn spray is parked — see `2026-09-15-linkedin-dead.md`.
- Prefer measurable own channels (Marketplace installs, echo / Open as MMT) over lottery distribution.
- Do not invent product claims Product cannot verify.
