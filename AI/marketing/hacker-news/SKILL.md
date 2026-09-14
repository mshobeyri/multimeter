---
name: multimeter-hacker-news-post
description: Write and submit Hacker News and Show HN posts for Multimeter, Testlight, and mmt.dev. Use when the user asks for Hacker News, HN, Show HN, launch posts, first comments, reply kits, or news.ycombinator.com copy.
---

# Multimeter Hacker News Post

## Purpose

Prepare a Show HN (or a follow-up HN comment) that is accurate, specific, and easy to try. Do not write generic SaaS launch copy.

This is **Hacker News**, not HackerRank.

## Product Positioning

- Multimeter is a Git-native REST client and API testing tool for VS Code.
- Requests, tests, suites, mocks, and docs are YAML (`.mmt`) files in the repo.
- Same files run in the editor and in CI via Testlight (`npx testlight run path/to/test.mmt`) and `mshobeyri/testlight-action`.
- Website: `https://mmt.dev`. Test server: `https://test.mmt.dev`.
- License: Apache 2.0. No account required.
- Current demo: https://youtu.be/lqSktxegPvk

Do not use `multimeter.dev`. Do not put “AI-powered” in the title.

## When to use drafts

Live launch copy lives in `AI/marketing/drafts/`:

- `show-hn-sep-2026.md` — current Show HN (Tuesday 15 Sep 2026).
- `show-hn-tuesday.md` — older draft; Action path in that file is stale. CI is `mshobeyri/testlight-action`, not `.github/actions/testlight`.

Prefer the current draft. Update it in place if facts changed (demo URL, Marketplace title, Open as MMT).

## Submit rules

1. One Show HN. Submit at https://news.ycombinator.com/submit around **14:00–16:00 local** (US morning).
2. **Title** starts with `Show HN:`. Keep it concrete.
3. **URL** is `https://mmt.dev`, not GitHub.
4. Leave the text field **blank** unless HN requires it.
5. Paste the first comment immediately after submit.
6. Stay on the thread 2–3 hours. Answer questions; do not ask for upvotes.
7. Do not cross-post LinkedIn/Reddit in the same hour.
8. Prior May 2025 item (https://news.ycombinator.com/item?id=48266440) was **not** Show HN, linked GitHub, 2 points, 0 comments. It does not block a real Show HN.

## Default title

```
Show HN: Multimeter – Git-native REST client and API tests in VS Code
```

## First comment

Must include:

- Who built it (Mehrdad) and why (collections outside Git).
- YAML `.mmt` in the repo; same file in editor and CI (Testlight + GitHub Action).
- Apache 2.0, no account.
- Demo: https://youtu.be/lqSktxegPvk
- **Open as MMT** is real: OpenAPI/Swagger, Postman, WSDL, `.http`, Bruno — Send without converting; convert when you want `.mmt` in Git.
- A no-key echo snippet against `https://test.mmt.dev/echo`.
- Docs: https://mmt.dev/docs

Do not mention Azure Pipelines or internal secrets.

## Output format

```markdown
Title:
[Show HN: …]

URL:
https://mmt.dev

Text field:
[blank, or the fallback one-liner if HN requires text]

First comment:
[paste-ready]

Short replies:
| Question | Reply |
```

## Quality check

- Title is not AI-flavored and does not use GitHub as the story URL.
- Echo snippet and Open as MMT match shipping product.
- Demo URL is the current featured video.
- Action referenced (if any) is `mshobeyri/testlight-action`.
