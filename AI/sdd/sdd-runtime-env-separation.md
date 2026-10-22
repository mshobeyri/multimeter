# SDD: Keep File/Manual Env Rows When setenv Writes Runtime

**Date:** 2026-10-22  
**Status:** Implemented  
**Scope:** Workspace env storage coexistence + Environment panel layout + run map resolve.  
**Non-goals:** Changing file→manual value-edit behavior; in-run `EnvStore`; CLI durable store.

---

## Problem

`setEnvironmentVariables` removes any existing var with the same name before pushing `source: 'runtime'`. After setenv, the file/manual baseline is gone.

## Model

Same storage key / flat `EnvVariable[]`. Layers may share a name:

| Layer | `source` | Panel table |
|-------|----------|-------------|
| Environment | `file`, `manual` | Environment Variables (unchanged UX) |
| Runtime | `runtime` | Runtime Variables |

Resolve for runs: apply environment layer, then overlay runtime (runtime wins when present).

## Rules

1. **setenv / runtime upsert** — update or append the runtime row only; never delete file/manual.
2. **Apply env file** — replace environment-layer rows by name; keep all runtime rows.
3. **Env table UX** — leave value/select/add handlers as they are today (including file→manual on value edit). Do not share those handlers with runtime rows (separate DOM classes).
4. **Runtime table** — own remove/clear/edit; edits keep `source: 'runtime'`.
5. **Presets** — match/apply environment-layer only.
6. **lastUpdate stamp** — key by `(name, layer)` so file and runtime of the same name stamp independently.

## Out of scope for this pass

- Reworking why value edit flips file→manual (existing product behavior).
- Separate workspaceState keys per layer.
