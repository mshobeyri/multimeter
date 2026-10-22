# SDD: Community / real-project Multimeter examples (`{product}-mmt`)

**Date:** 2026-10-17  
**Status:** In progress  
**Pilot:** `open-meteo-mmt`

---

## Summary

Define how Multimeter publishes **standalone** API-test repos named `{product}-mmt` (e.g. `open-meteo-mmt`), owned by **`mshobeyri`**, and wires them into the Multimeter monorepo as **git submodules** under `examples/real-projects/`.

These repos serve two goals:

1. **Community / growth** — discoverable suites for well-known public APIs (and later SoapUI/Postman migration targets), with a short README that lightly showcases Multimeter.
2. **Pre-release regression** — run real external APIs against Multimeter before release, from the main checkout.

Pedagogical trees (`examples/basic`, `intermediate`, `professional`, …) stay unchanged.

---

## Motivation

- In-repo `examples/` teach Multimeter concepts against `test.mmt.dev`. They do not attract users of real APIs.
- Separate `{product}-mmt` repos are easy to share, star, and link from upstream communities.
- Submodules under `examples/real-projects/` let maintainers **edit and run** those suites from the Multimeter workspace without a separate clone workflow.
- Prefer **public APIs that run without signup** so the first path is zero-friction; env files still document how to add keys when needed.

---

## Goals

| Goal | Measure |
|---|---|
| Zero-friction first run | Clone / open submodule → run suite with shipped env defaults (no account) |
| Clear Multimeter signal | README lists Multimeter features the suite demonstrates (not a full tutorial) |
| Easy maintainer workflow | Change files under `examples/real-projects/{product}-mmt`, commit in submodule, push remote |
| Pre-release check | Documented command(s) to run all real-project suites via `testlight` |
| Convert / migration story | Later targets may start from OpenAPI, Postman, Bruno, or WSDL |

## Non-goals

- Replacing pedagogical `examples/`
- Hosting upstream product code or forking those products
- A nested GitHub path like `mshobeyri/mmt/open-meteo` (GitHub repos are flat)
- A separate secrets system (use Multimeter `type: env` only)

---

## Design

### 1. Ownership and naming

| Item | Decision |
|---|---|
| Owner | `mshobeyri` |
| Repo name | `{product}-mmt` (lowercase, hyphens) |
| Example | `mshobeyri/open-meteo-mmt` |
| License | **MIT** for `{product}-mmt` repos (easy remix; Multimeter core remains its own license) |
| Namespace | Flat under the user; optional org / `mmt-` prefix later if volume grows |

### 2. Multimeter layout (submodules)

```
examples/
  basic/ …
  intermediate/ …
  professional/ …
  real-projects/           # NEW
    README.md              # index of submodule projects + how to init/update
    open-meteo-mmt/        # submodule → mshobeyri/open-meteo-mmt
    …/
```

- Each entry under `real-projects/` is a **git submodule** pointing at `https://github.com/mshobeyri/{product}-mmt`.
- Day-to-day editing happens inside the Multimeter clone at that path.
- Pushing updates: commit inside the submodule, push submodule remote, then bump the submodule pointer commit in Multimeter.

**Bootstrap (before first remote exists):** land the pilot as normal files under `examples/real-projects/open-meteo-mmt/`, then convert to a submodule once `mshobeyri/open-meteo-mmt` is created on GitHub.

### 3. Required layout inside each `{product}-mmt`

```
{product}-mmt/
  README.md              # comparison / why Multimeter (optional); links into multimeter/
  LICENSE                # MIT
  multimeter/            # the Multimeter project (day-to-day work)
    README.md            # run, coverage, env, layout, upstream
    multimeter.mmt       # type: env — project root marker + working defaults
    suite.mmt            # root suite — calls each test/<area>/suite.mmt
    api/                 # type: api definitions
    test/
      <area>/
        suite.mmt        # first in the folder — runs all tests beside it
        test_*.mmt       # type: test — import APIs via +/api/… ; varied inputs + accurate expects
  postman/               # optional — mirror collection for timing/context compare only
```

- **Project docs** live in `multimeter/README.md`. Root `README.md` may tell a Multimeter-vs-X story; it must not be the only place with run/env/layout.
- **No top-level `suites/` folder.** Area suites live **beside** the tests they run (`multimeter/test/<area>/suite.mmt`).
- Name tests `test_*.mmt` (not `*_test.mmt`) so `suite.mmt` sorts as the **first** file in each area folder.
- Ship **`multimeter/multimeter.mmt`** (not a bare `env.mmt`) so `+/` project-root imports resolve and the Extension can load workspace env.
- In tests, **prefer `+/api/….mmt`** over `../../api/….mmt` (see [Project root](../../docs/files/env/project-root.md) · [import](../../docs/files/test/import.md)).
- Root `suite.mmt` only references those area suites (items run in parallel by default — no `then` required between them).
- Prefer **several tests per API** (different cities, horizons, date windows) over a single smoke call.

Optional later (not required for v1):

- `ci/` or GitHub Actions calling `npx testlight run multimeter/suite.mmt --env-file multimeter/multimeter.mmt`
- `openapi/` / imported sources if the suite was converted
- `.gitignore` only if local overlays are introduced; prefer documenting env edits over ignored secret files for public no-key APIs

### 4. Env and secrets

- Always ship a `multimeter.mmt` with **working defaults** (base URLs, sample city as one nested choice map, etc.).
- Prefer APIs that need **no key** for the happy path.
- When a key or token is useful later:
  - Put the variable in `multimeter.mmt` (empty or placeholder).
  - README section **“Environment / secrets”**: variable names, where to get values, how to set them (Environment panel or `testlight -e` / `--env-file`).
- Do not invent a parallel secrets mechanism.

### 5. README shape (required sections)

Write each `{product}-mmt` README as if the **owner of that sample test project** wrote it for people who want to test that API — not as Multimeter internal docs.

**Do not** mention Multimeter SDDs, submodule strategy, “pilot”, pre-release regression, or other Multimeter-repo process. A short “uses Multimeter / `testlight`” line is enough.

Keep short. Run first.

1. **What this is** — suites for *this* API + link to Multimeter ([mmt.dev](https://mmt.dev))
2. **Run** — CLI and/or Extension (`testlight run suite.mmt --env-file multimeter.mmt`)
3. **What’s covered** — which upstream APIs / area suites
4. **Environment / secrets** — defaults + how to override / add keys
5. **Layout** — `multimeter.mmt`, `api/`, `test/<area>/{suite.mmt,test_*.mmt}` with `+/api/…` imports, root `suite.mmt`
6. **Upstream** — link to the public API docs + fair-use / attribution
7. **License** — MIT

### 5b. API / test conventions (must follow Multimeter docs)

- **API field order:** `url`, then `query`, then `method`, then `format` / headers / body (see [API request](../../docs/files/api/index.md#request)).
- **`expect` on the call (not follow-up `check`):** every validation that depends on **one** call’s outputs belongs in that call’s `expect` / `require` (list form for several ops on one field). Write **all** operator expects **unquoted** (`!= null`, `>=# 24`, `=1d~ <<c:datetime>>`, ranges — never `'>=# 24'`). Prefer **accurate** expects over bare non-null: for live timestamps use `=Ns~` with `<<c:datetime>>` / `<<c:date>>` (not `c:time`, which is clock-only; not a datetime regex); for fixed archive/history/climate windows use exact or `=^` against `e:` dates; also numeric ranges, string prefix/contains, lengths (`=#` / `>=#`), fuzzy text (`>N%`), or exact equality. See [Operators — Prefer accurate expects](../../docs/files/test/operators.md#prefer-accurate-expects-not-only--null).
- **`check` / `assert` only for two-sided compares:** use standalone `check` / `assert` when comparing **two different** outputs (or a step vs another step). Do not re-check a single call output with `- check:` after `expect`.
- **`report: all`:** set on calls (and on any remaining cross-output `check`) so users see every expect/check row in the Report list — not only failures.
- **Suite pacing:** suite `items` run **in parallel by default**. Use `then` only when a stage must wait on the previous one (see [Suite execution](../../docs/files/suite/execution.md)); do not insert `then` between every item by default.
- **Imports:** in tests use `+/api/….mmt` (project root via `multimeter.mmt`), not `../../api/….mmt`. Suite `items` that sit beside the suite file can stay relative (no `+/` needed).

### 6. Target selection criteria

Prefer targets that score well on:

| Criterion | Preference |
|---|---|
| Public, no signup for first run | Strongly preferred |
| Well known | Strongly preferred |
| Natural reason to keep a Multimeter suite | Tutorials, Postman users, SoapUI migrants, app integrators |
| Stable enough for pre-release regression | Prefer |
| Avoid | “Test GitHub/Stripe itself” style platforms where Multimeter is not a natural community fit |

**Pilot shortlist (order):**

1. **`open-meteo-mmt`** — first (this SDD)
2. `pokeapi-mmt`
3. `spacex-mmt`
4. `nominatim-mmt` (OpenStreetMap geocoding; fair-use / User-Agent)
5. `countryinfo-soap-mmt` (SoapUI / WSDL story)

### 7. Pilot: Open-Meteo

| Item | Value |
|---|---|
| Repo | `mshobeyri/open-meteo-mmt` |
| Path in Multimeter | `examples/real-projects/open-meteo-mmt` |
| Upstream | [Open-Meteo](https://open-meteo.com/) — free forecast + geocoding, no API key for non-commercial use |
| Defaults | Berlin (or similar) lat/lon; public base URLs |
| Attribution | README must note CC BY / Open-Meteo attribution requirements |

Pilot content expectations:

- Cover the public Open-Meteo product surface (not a single smoke endpoint)
- Follow the shared multi-project layout: [Start a Multimeter project](../../docs/tasks/start-a-project.md) · [AI project-layout](../../docs/AI/project-layout.md)
- Per-area `test/<area>/suite.mmt` beside the tests; root `suite.mmt` calls those area suites
- Multiple input variants per API (locations, horizons, date windows) with accurate expects (times/dates, numeric bands, string shape, lengths — not only `!= null`)
- README in product-owner voice (see §5)

### 8. Pre-release regression usage

From Multimeter root (after submodules initialized):

```sh
npx testlight run examples/real-projects/open-meteo-mmt/multimeter/suite.mmt \
  --env-file examples/real-projects/open-meteo-mmt/multimeter/multimeter.mmt
```

Later: a small script or npm script that runs every `examples/real-projects/*/suite.mmt` (network-dependent; may be manual or optional CI with network egress).

### 9. Maintainer workflow

1. Edit under `examples/real-projects/{product}-mmt/`.
2. Commit and push **inside the submodule** to `mshobeyri/{product}-mmt`.
3. In Multimeter, commit the updated submodule pointer.
4. Do not duplicate the same suite into `examples/basic|intermediate|professional`.

### 10. Relationship to convertors

When a target ships OpenAPI / Postman / Bruno / WSDL:

- Prefer convert → then tidy into the standard `api/` + `test/` + `suite.mmt` shape.
- README may mention “converted from …”.
- Pilot Open-Meteo is hand-written (simple public HTTP; convert optional later).

---

## Implementation plan

### Phase 0 — SDD (this document)

Done when accepted.

### Phase 1 — Pilot content (Open-Meteo)

1. Create `examples/real-projects/README.md` (index + submodule notes).
2. Add `examples/real-projects/open-meteo-mmt/` with root comparison README + `multimeter/` (project README, `multimeter.mmt`, `suite.mmt`, `api/`, `test/<area>/…`) and optional `postman/` compare.
3. Verify with `npx testlight run …` against the live Open-Meteo API.
4. Create GitHub repo `mshobeyri/open-meteo-mmt`, push, convert folder to submodule.

### Phase 2 — Process hardening

1. Template checklist copied into `examples/real-projects/README.md` (or a short `TEMPLATE.md`).
2. Optional npm script / doc section for “run all real-projects”.
3. Next targets from the shortlist (PokéAPI, SpaceX, Nominatim, CountryInfo SOAP).

### Phase 3 — Outreach

1. Link real-projects from Multimeter docs / website examples page.
2. Share `{product}-mmt` in communities that already use that API (forums, Discord, HN Show, LinkedIn).

---

## Risks

| Risk | Mitigation |
|---|---|
| Upstream API downtime / rate limits | Keep suites small; document fair use; fail soft in optional CI |
| Submodule friction for contributors | Document init/update; keep READMEs runnable from the standalone repo alone |
| Toy-API perception | Prefer production-quality public APIs (Open-Meteo) over echo servers |
| License confusion | MIT on example repos; Multimeter license unchanged and called out in README |

---

## Open questions (non-blocking)

- Whether Multimeter CI should run real-projects (network + flaky) or keep them pre-release / manual only.
- Exact User-Agent / attribution strings for Nominatim when that project is added.

---

## Acceptance criteria

- [ ] This SDD accepted
- [x] `open-meteo-mmt` layout matches §3 and runs with defaults (no signup)
- [x] Indexed under `examples/real-projects/`
- [x] README follows §5
- [ ] Remote `mshobeyri/open-meteo-mmt` exists and is submoduled (Phase 1.4)
