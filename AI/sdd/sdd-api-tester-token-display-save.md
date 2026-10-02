# SDD: API Tester Token Display / Edit + Simple Save

**Date:** 2026-09-28  
**Status:** Implemented (tester UI + display helpers)  
**Follow-up:** [sdd-token-form-consistency.md](./sdd-token-form-consistency.md) — unify idle preview + JSON quote types where this SDD’s L3 preview policy drifted in `projectTokenFieldPreview`.  
**Scope:** `mmtview` API tester UI (+ display-only helpers in `core` used by the UI). **Not** JSer, runner, CLI, suite execution, or network send semantics.

---

## Summary

Make the API **tester** easier to use:

1. **Idle (preview):** show **resolved** values for input/env slots; keep **runtime** tokens as friendly `{{r:…}}` / `{{c:…}}` (never expand random/current to a one-off value in the editor).
2. **Edit (first keypress/paste):** show **display tokens** in a uniform curly form — `{{i:xxx}}`, `{{e:xxx}}`, `{{r:epoch}}`, `{{c:…}}` — so the user edits the template, not a baked literal.
3. **Save UX:** drop the Monaco YAML **diff** popup; simple **Save** + **Discard**.
4. **Hard constraint:** JSer, `runner.runFile`, CLI, suite runs, and execution-time token resolution stay **unchanged**. Display/edit is view-layer only. YAML on disk stays `<<…>>` / bare `r:`/`c:` as today; `{{}}` is UI-only (round-trip on Save).

---

## Locked decisions

| # | Decision |
|---|----------|
| 1 | Enter-edit on **first keypress/paste**, not focus alone. Empty fields may show display tokens immediately. |
| 2 | **Send** re-resolves from **current edit-buffer tokens + inputs/env** (and when inputs/env change). No stale resolved snapshot. |
| 3 | Mixed literal + token (e.g. `Bearer {{e:token}}` in UI → `Bearer <<e:token>>` in YAML) is **allowed**; Save preserves user text. |
| 4 | Save writes **touched fields only** (today’s model). |
| 5 | YAML-under-dirty conflict: **Discard UI** vs **Keep UI** only. Save stays on the toolbar. |
| 6 | **Tester-only** for v1 (Edit API page unchanged). |
| 7 | **Examples** input editors stay plain values for v1 (no preview/edit dual-mode). |
| 8 | Light **muted preview** styling when YAML source still has tokens; normal styling in edit mode. |
| 9 | **Display token integrity:** UI form is always `{{prefix:rest}}` matching the short token — not long names like `{{RANDOM_EPOCH}}` / `{{random epoch}}`. |

---

## Display token integrity (UI only)

YAML / core keep existing forms (`<<i:x>>`, `<<e:x>>`, `<<r:epoch>>`, bare `r:epoch`, etc.).  
Tester **display** and **edit buffer** use one curly family:

| YAML / core (unchanged) | Tester display / edit |
|-------------------------|------------------------|
| `<<i:user>>` / `i:user` | `{{i:user}}` |
| `<<e:token>>` / `e:token` | `{{e:token}}` |
| `<<r:epoch>>` / `r:epoch` | `{{r:epoch}}` |
| `<<c:iso>>` / `c:iso` (etc.) | `{{c:iso}}` |

**Replace** today’s long-form runtime display (`{{random epoch}}`, `{{RANDOM_EPOCH}}`, `{{current …}}`) with the short `{{r:…}}` / `{{c:…}}` form for integrity with `i:`/`e:`.

Round-trip on Save / Send prep: `{{i:user}}` → `<<i:user>>` (or existing pack rules); same for `e`/`r`/`c`. Runners never see `{{}}` unless the user typed that literal into YAML themselves.

### Preview vs edit (per field)

| Mode | `i:` / `e:` | `r:` / `c:` |
|------|-------------|-------------|
| **Preview** (idle) | **Resolved** value (what Send will use) | Stay as `{{r:…}}` / `{{c:…}}` (do not freeze a random/current sample in the box) |
| **Edit** (after first key/paste) | `{{i:…}}` / `{{e:…}}` | `{{r:…}}` / `{{c:…}}` |

---

## Goals

| # | Goal |
|---|------|
| G1 | Idle: resolved `i:`/`e:`; runtime tokens as `{{r:}}`/`{{c:}}`. |
| G2 | Edit buffer: uniform `{{i:}}`/`{{e:}}`/`{{r:}}`/`{{c:}}` — not resolved literals, not `<<>>`, not `{{RANDOM_*}}`. |
| G3 | Save packs **tokens** into YAML (`<<…>>` / bare forms per existing pack), never accidental resolved env/input values. |
| G4 | Simple Save + Discard; no DiffEditor in this flow. |
| G5 | No JSer / runner / CLI behavior change. |

## Non-goals

- Changing `variableReplacer`, JSer, or runner pipelines.
- Autosave.
- Edit API dual-mode (v1).
- Examples-tab dual-mode (v1).
- Teaching runners about display mode.

---

## Hard boundary: UI vs execution

```
┌─────────────────────────────────────────────────────────┐
│  mmtview API tester                                     │
│  - preview (resolved i/e; {{r}}/{{c}})                  │
│  - edit buffer ({{i}}/{{e}}/{{r}}/{{c}})                │
│  - Save / Discard → pack to YAML << >> / bare           │
└───────────────────────────┬─────────────────────────────┘
                            │ YAML text / APIData only
                            ▼
┌─────────────────────────────────────────────────────────┐
│  core (unchanged contract)                              │
│  runner.runFile → JSer → network / eval                 │
└─────────────────────────────────────────────────────────┘
```

Display helpers may live next to existing `bodyRuntimeTokens` / `apiBodyEdit` but must remain **display-only** (not imported by JSer/runner).

---

## Save / Discard

- Affordance when tester has overrides (same trigger as today).
- **Save** — pack touched fields from **edit/token buffer** → `apiToYaml` → file → clear overrides.
- **Discard** — restore applied YAML / reset tester.
- **Remove** DiffEditor + parked-diff from this path if unused elsewhere.
- **Conflict** (YAML changed under dirty UI): Discard UI vs Keep UI only.

---

## Implementation sketch (UI only)

1. Extend display projection: `<<i:>>`/`<<e:>>` ↔ `{{i:}}`/`{{e:}}`; rewrite `r`/`c` display from long-form to `{{r:}}`/`{{c:}}`.
2. Preview uses resolved leaves for `i`/`e`; keeps `{{r}}`/`{{c}}` from source.
3. First keypress/paste swaps field to display-token buffer; subsequent edits stay there.
4. Send / input changes: re-resolve from token buffer + inputs/env via existing prepare path (convert `{{}}` → resolvable forms at the UI→request boundary only).
5. Save: display tokens → YAML tokens; touched fields only.
6. Replace UnsavedChangesWarning diff UI with Save + Discard.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Save bakes resolved values | Edit buffer is display tokens; Save packs from that buffer only |
| Confusion with old `{{random …}}` | Migrate display helpers + tests; one curly grammar |
| JSON body unquoted tokens | Reuse/adjust stringify rules for `{{i:}}` etc. like today’s runtime tokens |
| Focus/tab surprise | Value swap only on first key/paste |

---

## Success criteria

- Idle: resolved `i:`/`e:`; `{{r:epoch}}` not `{{RANDOM_EPOCH}}` / `{{random epoch}}`.
- Edit: `{{i:user}}` / `{{e:token}}` / `{{r:epoch}}` visible and editable.
- Save writes `<<i:user>>` (etc.) into YAML; Run in Core / CLI still work unchanged.
- No DiffEditor on unsaved tester path.
- Compile + targeted display-token tests green.
