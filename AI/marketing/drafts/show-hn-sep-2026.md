# Show HN — Tuesday 15 Sep 2026

Post around **14:00–16:00** local (US morning). One Show HN only. Do not ask friends to upvote. Do not post LinkedIn/Reddit in the same hour.

Previous attempt (2 points, 0 comments, **not** Show HN): https://news.ycombinator.com/item?id=48266440

Submit: https://news.ycombinator.com/submit

## Pre-flight

- [ ] Marketplace title: **Multimeter – REST Client & API Testing**
- [ ] https://mmt.dev loads; `/demos`, `/compare/postman`, and docs work
- [ ] Extension installs from Marketplace; echo snippet below works with **Send**
- [ ] Demo: https://youtu.be/lqSktxegPvk
- [ ] Stay on the thread for the first 2–3 hours after posting

---

## Submit

**Title**

```
Show HN: Multimeter – Git-native REST client and API tests in VS Code
```

**URL** (not GitHub)

```
https://mmt.dev
```

Leave the text field blank.

---

## First comment (paste immediately after submit)

```
I'm Mehrdad. I got tired of API collections living outside the repo while the code lived in Git.

Multimeter is a VS Code extension: requests, tests, suites, mocks, and docs are YAML (.mmt) files in the repo. Same file in the editor and in CI (testlight CLI + GitHub Action). No account. Apache 2.0.

90s silent demo: https://youtu.be/lqSktxegPvk

You can also right-click OpenAPI, Postman, WSDL, .http, or Bruno → Open as MMT and Send without converting first. Convert to .mmt when you want it in Git.

Quick try (no API keys): install the extension, create echo.mmt:

  type: api
  url: https://test.mmt.dev/echo
  method: post
  format: json
  body:
    message: hello

Click Send. test.mmt.dev echoes it back.

Docs: https://mmt.dev/docs
```

---

## Short replies

| Question | Reply |
|----------|--------|
| vs Bruno? | Bruno stays Bruno-compatible. We add tests, suites, mocks, and CI on the same YAML files. |
| vs REST Client? | Same `.http` files, plus structured tests, env, and CI. |
| vs Postman? | Files in Git, no cloud workspace. Import collections when you migrate. |
| OpenAPI / Postman without convert? | **Open as MMT** — spec file stays as-is, pick an operation, Send. **Convert to MMT** when you want `.mmt` in the repo for CI. |
| Why YAML? | Diffs in PRs. There is a UI editor if you do not want to type YAML. |
| AI? | MCP for Cursor/Copilot to write `.mmt` files. Optional judge step for fuzzy replies. Not required to send a request. |
| Monetization? | Free, no account. |

---

## Do not

- Put “AI-powered” in the title
- Link GitHub as the main URL
- Ask for upvotes
- Cross-post LinkedIn/Reddit in the same hour
- Mention Azure or internal secrets
- Use the stale Action path `.github/actions/testlight` — CI is `mshobeyri/testlight-action`
