# SDD: Open Source Launch

**Date:** 2026-03-15
**Status:** Not started

---

## Summary

Prepare the Multimeter repository for public open-source release under the **Business Source License 1.1 (BSL 1.1)**. The BSL allows full source visibility and free non-competing use, while restricting competing commercial products for 4 years per release, at which point each version converts to **Apache 2.0**.

This SDD covers: licensing, community files, GitHub configuration, repository hygiene, README updates, and ongoing governance.

---

## Motivation

Multimeter has been developed as a private/proprietary project. Making it open-source will:

- **Increase adoption** — developers can inspect, build, and trust the tool
- **Enable community contributions** — bug reports, PRs, translations, integrations
- **Improve discoverability** — GitHub search, open-source directories, developer discussions
- **Build credibility** — open-source projects in the API testing space (Karate, Bruno, Robot Framework) earn stronger trust

However, full permissive licensing (MIT/Apache) creates a risk of early cloning — a competitor could fork the entire product and rebrand it commercially. The BSL 1.1 mitigates this by restricting competing commercial use for 4 years per release while keeping the source fully visible and usable by everyone else.

### License rationale

| License | Adoption | Clone Protection | OSI Approved |
|---|---|---|---|
| MIT | Highest | None | Yes |
| Apache 2.0 | High | None (+ patent grant) | Yes |
| AGPL-3.0 | Medium | SaaS copyleft only | Yes |
| **BSL 1.1** | **Medium** | **Direct competition restricted** | **No (source-available)** |
| Proprietary | Low | Full | N/A |

**Chosen: BSL 1.1** — used by HashiCorp (Terraform, Vault), Sentry, CockroachDB, MariaDB. Proven model for developer tools that need clone protection during early growth.

---

## Design

### 1. License: BSL 1.1

#### Parameters

| BSL Field | Value |
|---|---|
| **Licensor** | Mehrdad Shobeyri |
| **Licensed Work** | Multimeter (VS Code extension, testlight CLI, mmt-core library) |
| **Additional Use Grant** | You may use the Licensed Work for any purpose **except** offering a commercial product or service that competes with Multimeter's primary functionality (API testing, test execution, API documentation generation, or mock server capabilities). Internal use, CI/CD integration, and non-competing commercial use are permitted without restriction. |
| **Change Date** | Four years from the date of each release (e.g., version released on 2026-03-15 converts on 2030-03-15) |
| **Change License** | Apache License, Version 2.0 |

#### What is allowed

- Using Multimeter (extension, CLI, Docker) to test your own APIs
- Running `testlight` in CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins, etc.)
- Modifying the source for personal or internal company use
- Building integrations, plugins, or tooling that uses Multimeter
- Forking for non-competing purposes (e.g., adding internal features, fixing bugs)
- Academic use, education, research

#### What is restricted

- Forking and selling/distributing a competing API testing tool based on Multimeter's code
- Offering Multimeter as a hosted/SaaS service that competes with Multimeter
- Rebranding and distributing a commercial product derived from Multimeter's code

#### Files to create/update

| File | Action |
|---|---|
| `LICENCE.md` | Replace MIT content with full BSL 1.1 text + parameters |
| `package.json` | Change `"license": "MIT"` → `"license": "BSL-1.1"` |
| `mmtcli/package.json` | Add `"license": "BSL-1.1"` |

---

### 2. Community Files

#### 2a. CONTRIBUTING.md

Location: `/CONTRIBUTING.md`

Contents:
- Development setup instructions (`git clone`, `npm install`, `npm run compile`, `npm test`)
- Project structure overview (core, src, mmtview, mmtcli, docs, website)
- Coding guidelines (2-space indent, always braces, core must be platform-neutral)
- Pull request process (fork → branch → test → PR)
- Link to Code of Conduct

#### 2b. CODE_OF_CONDUCT.md

Location: `/CODE_OF_CONDUCT.md`

Use the **Contributor Covenant v2.1** — the industry standard adopted by Linux, Kubernetes, Rails, etc. Contains:
- Standards for positive behavior
- Standards for unacceptable behavior
- Enforcement responsibilities
- Reporting mechanism (email to maintainer)

#### 2c. SECURITY.md

Location: `/SECURITY.md`

Contents:
- How to report vulnerabilities (private email, NOT public issues)
- Response timeline commitment (48h acknowledgment, 7-day fix for critical)
- Supported versions table

---

### 3. GitHub Templates

#### 3a. Bug Report Template

Location: `.github/ISSUE_TEMPLATE/bug_report.md`

Fields:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Environment (OS, Multimeter version, VS Code version, Node.js version)
- Screenshots/logs (optional)

#### 3b. Feature Request Template

Location: `.github/ISSUE_TEMPLATE/feature_request.md`

Fields:
- Problem description
- Proposed solution
- Alternatives considered

#### 3c. Pull Request Template

Location: `.github/PULL_REQUEST_TEMPLATE.md`

Checklist:
- `npm test` passes
- `npm run compile --silent` succeeds
- Docs updated if user-facing
- No `vscode`/`fs`/browser imports in `core/`

---

### 4. README.md Updates

Add to the root `README.md`:

#### License badge (top of file, after logo)

```markdown
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENCE.md)
```

#### Contributing section (before or after Documentation)

```markdown
## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
```

#### License section (bottom of file)

```markdown
## 📄 License

Multimeter is licensed under the [Business Source License 1.1](LICENCE.md).
You can use it freely for any purpose except building a competing commercial product.
Each version converts to Apache 2.0 four years after its release date.
```

---

### 5. Repository Hygiene

Before making the repo public, audit for sensitive content:

#### 5a. Secrets scan

- [ ] No API keys, tokens, or passwords in source files
- [ ] No hardcoded credentials in workflow files (use GitHub Secrets)
- [ ] No `.env` files committed (verify `.gitignore`)
- [ ] Review git history for accidentally committed secrets (use `git log --all -p | grep -i "password\|secret\|token\|api.key"`)

#### 5b. Internal content review

- [ ] Review `devdocs/` — decide what stays public vs. what should be removed
  - `sdd-competitive-strategy.md` — contains detailed competitor analysis and strategic roadmap; consider keeping private
  - `skills-release-deploy.md` — release process details; fine to keep public
  - Other SDDs — fine to keep public (shows transparency)
- [ ] Remove `multimeter-1.14.3/` directory (old release artifact in repo)
- [ ] Remove or `.gitignore` any local test data, credentials, or proprietary API endpoints in demo/example files

#### 5c. .gitignore verification

Ensure these are ignored:
- `.env`, `.env.*`
- `*.vsix`
- `dist-release/`
- `node_modules/`
- IDE-specific files (`.idea/`, `.vscode/settings.json` with secrets)

---

### 6. GitHub Repository Settings

After making public:

- [ ] **Visibility**: Set to Public
- [ ] **Description**: "All possible tests for your service as code — API testing, documentation, and mocking in VS Code"
- [ ] **Topics**: `api-testing`, `vscode-extension`, `test-automation`, `http-testing`, `websocket`, `yaml`, `cli`, `mock-server`, `api-documentation`, `ci-cd`
- [ ] **Website**: `https://mmt.dev`
- [ ] **Social preview**: Upload a branded image (1280x640px) — the logo + tagline
- [ ] **Discussions**: Enable
- [ ] **Issues**: Ensure enabled with templates
- [ ] **Wiki**: Disable (use `docs/` instead)
- [ ] **Sponsorship**: Consider enabling GitHub Sponsors
- [ ] **Branch protection**: Protect `master` — require PR reviews, status checks

---

## Implementation Plan

### Phase 1: License & Community Files

| # | Task | Effort |
|---|---|---|
| 1.1 | Replace `LICENCE.md` with BSL 1.1 text + parameters | Small |
| 1.2 | Update `package.json` and `mmtcli/package.json` license fields | Small |
| 1.3 | Create `CONTRIBUTING.md` | Small |
| 1.4 | Create `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) | Small |
| 1.5 | Create `SECURITY.md` | Small |

### Phase 2: GitHub Templates & README

| # | Task | Effort |
|---|---|---|
| 2.1 | Create `.github/ISSUE_TEMPLATE/bug_report.md` | Small |
| 2.2 | Create `.github/ISSUE_TEMPLATE/feature_request.md` | Small |
| 2.3 | Create `.github/PULL_REQUEST_TEMPLATE.md` | Small |
| 2.4 | Add license badge, contributing section, and license section to `README.md` | Small |

### Phase 3: Repository Hygiene

| # | Task | Effort |
|---|---|---|
| 3.1 | Audit source for secrets/credentials | Medium |
| 3.2 | Review and clean `devdocs/` (decide public vs. private content) | Medium |
| 3.3 | Remove `multimeter-1.14.3/` directory | Small |
| 3.4 | Verify `.gitignore` completeness | Small |

### Phase 4: GitHub Configuration

| # | Task | Effort |
|---|---|---|
| 4.1 | Set repo description, topics, website, social preview | Small |
| 4.2 | Enable Discussions | Small |
| 4.3 | Configure branch protection rules | Small |
| 4.4 | Set repo visibility to Public | Small |
| 4.5 | Optionally enable GitHub Sponsors | Small |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Competitor forks the code | High | BSL 1.1 restricts competing commercial use for 4 years |
| Contributors confused by BSL (not OSI-approved) | Medium | Clear license explanation in README + CONTRIBUTING; BSL is well-understood in the industry (HashiCorp, Sentry) |
| Secrets leaked in git history | High | Run `git log` audit before going public; use `git-filter-repo` to scrub if needed |
| Low initial contribution activity | Low | Expected for early-stage projects; focus on adoption first, contributions follow |
| `devdocs/competitive-strategy` becomes public | Medium | Review and decide: remove, redact, or keep as-is (transparency can build trust) |

---

## FAQ

**Q: Can companies use Multimeter in their CI/CD?**
A: Yes. Using Multimeter to test your own APIs is always permitted.

**Q: Can I fork and add features for my company?**
A: Yes, as long as you aren't building a competing API testing product.

**Q: When does it become fully open source?**
A: Each version automatically converts to Apache 2.0 four years after release.

**Q: Is BSL considered open source?**
A: BSL is "source-available." It is not OSI-approved open source, but the source code is fully visible and usable. After the change date, it becomes Apache 2.0 (fully OSI-approved).

---

### 7. CI/CD for Open-Source Contributions

The existing GitHub Actions workflow (`release-testlight.yml`) only handles release builds triggered by version tags. For an open-source project, we need a CI workflow that runs on every PR and push to `master`.

#### 7a. PR Validation Workflow

Location: `.github/workflows/ci.yml`

Triggers:
- `pull_request` targeting `master`
- `push` to `master`

Steps:
1. Checkout code
2. Setup Node.js (match engine from `package.json`)
3. `npm install`
4. `npm run compile --silent` — full build (core, webview, types, lint, esbuild)
5. `npm run test` — Jest tests
6. `npm run check-types` — TypeScript type checking
7. `npm run lint` — ESLint

This ensures no PR can be merged without passing the full build and test suite.

#### 7b. Stale Issue / PR Bot (optional)

Consider enabling the `actions/stale` action to automatically label and close issues/PRs with no activity after 60 days. Keeps the tracker manageable.

---

### 8. Source File License Headers

Add a short BSL 1.1 header comment to all source files (`.ts`, `.tsx`). This is standard practice for BSL-licensed projects (HashiCorp, CockroachDB) and serves as a legal notice even when files are viewed in isolation.

#### Header format

```typescript
// Copyright (c) Mehrdad Shobeyri. All rights reserved.
// Licensed under the Business Source License 1.1. See LICENCE.md for details.
```

#### Scope

Add to all files in:
- `core/src/**/*.ts`
- `src/**/*.ts`
- `mmtview/src/**/*.ts`, `mmtview/src/**/*.tsx`
- `mmtcli/src/**/*.ts`

Skip generated, vendored, and configuration files (`.json`, `.css`, `.html`, build output).

#### Automation

Add a check script or CI step that verifies new files include the header. Can use `grep -rL` to find files missing the header.

---

### 9. Contributor License Agreement (CLA)

Since the project uses BSL 1.1 (not a standard OSI license), a CLA is important. It ensures that:
- Contributors grant the project the right to use their contributions under the current and future license
- The licensor can continue to relicense (e.g., the BSL → Apache 2.0 change date mechanism works)
- There is no ambiguity about IP ownership of contributions

#### Approach: CLA Assistant (lightweight)

Use [CLA Assistant](https://cla-assistant.io/) — a free GitHub App that:
- Presents a lightweight CLA to first-time contributors via a PR comment
- Contributors sign by commenting "I agree" or clicking a link
- Tracks signatures in a public gist
- Blocks PR merge until CLA is signed

#### CLA Text (summary)

> By submitting a contribution to this project, you agree that:
> 1. Your contribution is your original work (or you have the right to submit it)
> 2. You grant the project maintainer a perpetual, irrevocable, worldwide, royalty-free license to use, modify, and distribute your contribution under the project's current or future license terms
> 3. You understand this project is licensed under BSL 1.1 and may be relicensed under Apache 2.0 per the change date schedule

---

### 10. Dependency License Audit

Before going public, audit all dependencies to ensure compatibility with BSL 1.1 and no copyleft contamination.

#### Current dependencies (root)

| Package | License | Risk |
|---|---|---|
| `ajv` | MIT | None |
| `axios` | MIT | None |
| `buffer` | MIT | None |
| `uuid` | MIT | None |
| `ws` | MIT | None |
| `xml-js` | MIT | None |
| `yaml` | ISC | None |

All current production dependencies use permissive licenses (MIT/ISC). No issues.

#### Audit process

1. Run `npx license-checker --production --summary` in each workspace root
2. Flag any GPL, AGPL, LGPL, or SSPL dependencies
3. For transitive dependencies, check the full tree: `npx license-checker --production --csv > licenses.csv`
4. Re-run this audit before each major release

---

### 11. Distribution Channel Updates

Multimeter is distributed through multiple channels. Each needs license metadata updated.

#### 11a. VS Code Marketplace

- The Marketplace listing pulls license from `package.json` → update to `"BSL-1.1"`
- Add a "License" note in the extension description on the Marketplace explaining BSL in plain language
- The Marketplace does accept non-OSI licenses — Bruno (MIT), but also Wallaby.js (proprietary) are listed

#### 11b. npm (testlight CLI)

- `mmtcli/package.json` already has a `license` field → update to `"BSL-1.1"`
- Add a `LICENSE` file in `mmtcli/` or ensure the root `LICENCE.md` is included in the npm package
- npm renders license badges automatically from `package.json`

#### 11c. Docker Hub

- Update the Docker Hub description (via `scripts/update-dockerhub-readme.sh`) to mention BSL 1.1
- Add a `LICENCE.md` copy inside the Docker image (already included if `COPY . .` is in Dockerfile)

#### 11d. Homebrew

- Homebrew formula in `packaging/homebrew/` should reference the license
- Homebrew accepts non-OSI licenses but flags them — set `license "BSL-1.1"` in the formula

#### 11e. GitHub Action

- The custom action in `.github/actions/testlight/` should reference the license in its `action.yml` metadata
- Users consuming the action in their CI are not redistributing — no license issue

---

### 12. Announcement & Launch Plan

#### 12a. Pre-launch (1–2 weeks before)

- [ ] Finalize all community files (CONTRIBUTING, COC, SECURITY, templates)
- [ ] Complete secrets audit and repository cleanup
- [ ] Set up CLA Assistant
- [ ] Create CI workflow and verify it passes
- [ ] Prepare announcement blog post for mmt.dev
- [ ] Prepare social media posts (Twitter/X, LinkedIn, Reddit)

#### 12b. Launch day

- [ ] Flip repository to Public
- [ ] Publish blog post on mmt.dev: "Multimeter is now source-available"
- [ ] Post to:
  - Reddit: r/webdev, r/node, r/programming, r/vscode
  - Hacker News (Show HN)
  - Twitter/X with demo GIF/video
  - LinkedIn
  - Dev.to article
- [ ] Update VS Code Marketplace description to mention source-available
- [ ] Pin an issue: "Welcome! Start here" with links to docs, contributing guide, and discussion board

#### 12c. Post-launch (first 2 weeks)

- [ ] Monitor issues and discussions daily — fast response to early adopters builds trust
- [ ] Label "good first issue" on 5–10 easy tasks to attract contributors
- [ ] Respond to HN/Reddit comments
- [ ] Track GitHub stars, forks, and traffic via Insights

---

### 13. Governance Model

#### Maintainership

- **BDFL (Benevolent Dictator For Life)**: Mehrdad Shobeyri — final authority on merges, releases, and roadmap
- As the project grows, appoint trusted contributors as **committers** with merge access to specific areas (e.g., `docs/`, `mmtview/`, `mmtcli/`)

#### Decision-making

- Small changes: PR review and merge by any committer
- Significant changes (new features, breaking changes, architecture): require discussion in a GitHub Discussion or issue before implementation
- License or governance changes: BDFL decision, with community input period

#### Roadmap visibility

- Maintain a public `ROADMAP.md` or use GitHub Projects board to show planned features
- Label issues with `roadmap` to indicate planned work vs. community requests

---

### 14. Change Date Tracking

BSL 1.1 requires tracking when each version converts to Apache 2.0. Maintain a change date schedule.

#### Change date table

| Version | Release Date | Change Date (Apache 2.0) |
|---|---|---|
| 1.14.3 | 2026-03-15 | 2030-03-15 |
| *(future versions appended here)* | | |

#### Implementation

- Add a `CHANGE_DATES.md` file to the repo tracking this schedule
- Automate: update the table as part of the release workflow (the `release-testlight.yml` action can append the new version + date)
- Include a note in `LICENCE.md` referencing this file

---

## Appendix A: BSL 1.1 Full Text Template

The full BSL 1.1 text to be placed in `LICENCE.md`:

```
Business Source License 1.1

Parameters

Licensor:             Mehrdad Shobeyri
Licensed Work:        Multimeter <version>
                      The Licensed Work is (c) Mehrdad Shobeyri.
Additional Use Grant: You may use the Licensed Work for any purpose except
                      offering a commercial product or service that competes
                      with Multimeter's primary functionality: API testing,
                      test execution, API documentation generation, or mock
                      server capabilities. Internal use, CI/CD integration,
                      and non-competing commercial use are permitted without
                      restriction.
Change Date:          Four years from the date of each Licensed Work release.
Change License:       Apache License, Version 2.0

For information about alternative licensing arrangements for the Licensed Work,
please contact: mehrdad@mmt.dev

Notice

Business Source License 1.1 (BSL 1.1) is not an Open Source license. However,
the Licensed Work will eventually be made available under an Open Source License,
as stated in this License.

<Full BSL 1.1 legal text from https://mariadb.com/bsl11/ inserted here>
```

---

## Appendix B: Checklist Summary

A single consolidated checklist for the entire launch:

**License**
- [ ] Replace `LICENCE.md` content with BSL 1.1 text + parameters
- [ ] Update root `package.json` license to `"BSL-1.1"`
- [ ] Update `mmtcli/package.json` license to `"BSL-1.1"`
- [ ] Add license headers to all source files
- [ ] Create `CHANGE_DATES.md`

**Community**
- [ ] Create `CONTRIBUTING.md`
- [ ] Create `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- [ ] Create `SECURITY.md`
- [ ] Set up CLA Assistant

**GitHub**
- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Create `.github/workflows/ci.yml` (PR validation)
- [ ] Set repo description, topics, website, social preview
- [ ] Enable Discussions
- [ ] Configure branch protection on `master`
- [ ] Pin "Welcome" issue

**README**
- [ ] Add BSL 1.1 license badge
- [ ] Add Contributing section
- [ ] Add License section

**Hygiene**
- [ ] Run secrets audit on full git history
- [ ] Review `AI/sdd/` content for sensitive strategies
- [ ] Verify `.gitignore` completeness
- [ ] Audit dependency licenses

**Distribution**
- [ ] Update VS Code Marketplace listing
- [ ] Update npm package license metadata
- [ ] Update Docker Hub description
- [ ] Update Homebrew formula license
- [ ] Update GitHub Action metadata

**Launch**
- [ ] Prepare blog post for mmt.dev
- [ ] Prepare social media posts
- [ ] Flip repo to Public
- [ ] Post announcements (Reddit, HN, Twitter/X, LinkedIn, Dev.to)
- [ ] Label 5–10 "good first issue" items
- [ ] Monitor and respond to early feedback
