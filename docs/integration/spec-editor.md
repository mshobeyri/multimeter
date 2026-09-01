# Spec editor (Open as MMT)

When you **Run directly** — **Open as MMT** on a Postman collection, OpenAPI spec, WSDL, `.http` file, or Bruno request/collection — Multimeter opens a **split spec editor**: the source stays on the left; the right pane is for picking what to run and sending or running it. Sends and runs do not edit the source file.

## Request picker

Click {{btn:list-tree}} in the header (**All** / test view) or next to the method dropdown (**API** view) to open the **request picker**.

| Menu row | Label | Right pane | Primary action |
|---|---|---|---|
| **All** | `TEST` | Test runner ({{btn:beaker}} title chip) | **Run** every request in order as one sequential test |
| Operation / request | `GET`, `POST`, `PUT`, … | API tester | {{btn:send:Send}} that single request |
| Named example | {{btn:lightbulb}} + example name | API tester | {{btn:send:Send}} with that example's inputs |

**All** appears only for **HTTP** (`.http`, `.rest`, `.https`) and **Bruno** (single `.bru` or `bruno.json` collection).

**OpenAPI**, **Postman**, and **WSDL** list operations only (plus named examples when the spec defines them). There is no **All** row.

Choosing a different row switches between the API tester and the test runner — you do not use a separate API/test toggle.

### Save as MMT

Hover a picker row and click {{btn:save-as}} to write a new `.mmt` file:

| Selection | Generated file |
|---|---|
| **All** | One `type: test` with a `call` step per request |
| Operation / request | One `type: api` |
| Named example | One `type: api` with that example in `examples` |

## Format-specific guides

- [OpenAPI](./openapi.md) · [Postman](./postman.md) · [WSDL](./wsdl.md)
- [HTTP file](./http-file.md) · [Bruno](./bruno.md)

Convert the whole source to a project tree with **Convert to MMT...** in the Explorer (separate from the picker).
