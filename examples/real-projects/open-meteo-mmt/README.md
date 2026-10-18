# Open-Meteo — Multimeter vs Postman

[Multimeter](https://mmt.dev) / `testlight` suites for the public [Open-Meteo](https://open-meteo.com/) weather APIs live in [`multimeter/`](./multimeter/) (see that folder’s [README](./multimeter/README.md) for run, coverage, env, and layout).

This root README is the **comparison story**: why switch from Postman (also summarized on [mmt.dev/compare/postman](https://mmt.dev/compare/postman)). The Multimeter project itself needs **no API key**.

## Why Multimeter (vs Postman)

Multimeter runs suite items **in parallel** by default — area suites and tests overlap instead of waiting in a single queue. That is a practical reason to switch: results arrive sooner as coverage grows, without a separate parallel runner or collection gymnastics.

This sample is only a **small** Open-Meteo suite (**59** tests, **~61** HTTP calls). Even at this size, Multimeter already wins on run time, how much an AI must load, how much you assert, and how you change or ship the suite.

### 1. Faster results

| | Multimeter (`testlight`) | Postman (Newman) |
|---|---:|---:|
| Wall clock (live Open-Meteo, same machine) | **~0.8–1.0 s** | **~4.3–5.7 s** |
| Suite execution | Parallel | One request after another |

On a real product suite — hundreds of APIs and cases — that wall-clock gap compounds.

### 2. Less context for AI (and for reviews)

Same HTTP coverage, measured on this sample (`multimeter/` vs the comparison collection):

| | Multimeter project | Postman collection |
|---|---:|---:|
| Shape | **98** small `.mmt` / JSON files | **1** JSON blob |
| Size on disk | **~42 KB** (~11k tokens @ ~4 chars) | **~91 KB** pretty (~23k tokens) |
| vs Multimeter | — | **~2.2×** more text to ingest |

Agents and reviewers can open **one area** (e.g. `multimeter/test/forecast/` ≈ 3 KB) instead of always loading the whole collection (~91 KB).

### 3. Deeper assertions (same calls)

| | Multimeter | Postman mirror |
|---|---:|---:|
| Checks on this suite | **~340** expect / list-op / check units | **61** (`pm.test` status 200 only) |
| What fails look like | Field-level expects, time ops, ranges, `report: all` | Request passed/failed |

You get the same HTTP surface with far more signal when something breaks — without writing dozens of collection scripts.

### 4. Cheaper to change (locality)

| Task | Multimeter | Postman |
|---|---|---|
| Add one city/horizon case | Add/edit **1–2** small files under `multimeter/test/<area>/` | Edit a **~91 KB** collection JSON |
| Review in git | Focused YAML diff | Noisy JSON diff, easy merge conflicts |
| Scope an AI edit | Point at one folder or file | Dump the whole collection into context |

### 5. Clearer failures + simpler CI

**Failure diagnosis:** Multimeter reports which field/operator failed (with `report: all` you still see the passing rows). The Postman mirror only tells you the request’s status check failed.

**CI surface:**

```sh
# Multimeter — one command, project env, exit code from the suite
npx testlight run multimeter/suite.mmt --env-file multimeter/multimeter.mmt

# Postman — collection path + Newman; assertions are whatever you scripted
npx newman run postman/open-meteo.root-suite.postman_collection.json
```

Switching means YAML-in-git tests, accurate expects, parallel suites, modular files for humans and AI, and a one-line `testlight` CI entry — even before this sample grows.

## Comparison only

[`postman/`](./postman/) and [`compare-timing.sh`](./compare-timing.sh) exist only to reproduce the numbers above — not a day-to-day workflow.

```sh
./compare-timing.sh
```

Day-to-day Open-Meteo work: [`multimeter/README.md`](./multimeter/README.md).

## License

MIT
