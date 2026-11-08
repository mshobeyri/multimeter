# Request modes

The API tester request toolbar has a **mode** control (collapsed: current mode icon only). Click it to open a dropdown with **Edit**, **Telescope**, and **Sandbox** (icon + name). Picking a mode closes the menu. Escape or a click outside also closes it.

Edit and Telescope are remembered across reopen. Sandbox is session-only — leaving it (or closing the file) drops the clone; the next open starts in Edit or Telescope.

## Modes

| Mode | Icon | Display | Writes YAML? | Send |
|---|---|---|---|---|
| **Edit** | {{btn:edit-code}} | Token text (`{{i:…}}`, `{{e:…}}`, `{{r:…}}`, …) | Yes | Remints `r:` / `c:` from the YAML, then sends |
| **Telescope** | {{btn:telescope}} | Resolved values (idle preview keeps `r:` / `c:` as tokens) | Yes — edits still write tokens | Same remint-then-send as Edit |
| **Sandbox** | Sandbox glyph | Resolved values on an isolated clone of the current YAML | Never | Sends the sandbox session request as edited |

## Edit and Telescope

Use these when you want the file to stay the source of truth:

- **Edit** — author tokens and literals; what you type is what goes into YAML.
- **Telescope** — inspect what `i:` / `e:` resolve to; change a resolved field and Multimeter writes the token form back to YAML.

Declaration pencils (Doc, Inputs, Outputs / Setenv), Auth, and Settings all write the file in these modes. See [Edit API fields](./edit.md).

## Sandbox

Sandbox is for trying a request without touching the file.

### Enter

Switch to Sandbox from Edit or Telescope. Multimeter clones the current YAML buffer into a sandbox session and snapshots runtime inputs / example selection. There is no save/discard dialog.

### While active

- The tester dims slightly (about 85% opacity) with a thin sand-yellow frame so the mode is obvious.
- Params, Headers, Body, Cookies, URL, method, and runtime Inputs edit the **clone only**.
- Declaration pencils (Title, Tags, Description, Inputs, Outputs, Setenv) are hidden.
- Auth and Settings are not editable (read-only tooltip).
- **Send** uses the sandbox session values — it does not remint from YAML or write the file.
- Response, history, environment panel, and token cache stay shared with the normal tester (leaving Sandbox does not roll those back).

### Reset / YAML wins

While Sandbox is active, a **Reset** control ({{btn:discard}}) sits left of the mode dropdown. It re-clones from the current YAML and resets runtime inputs to the file defaults — same as editing the YAML on the left. UI sandbox edits are discarded; there is no merge.

### Leave

Switch back to Edit or Telescope (or leave the file). The sandbox session is dropped with no merge into YAML. Runtime inputs / example selection are restored to the snapshot taken on enter.

## When to use which

| Goal | Mode |
|---|---|
| Author or fix the committed request | **Edit** |
| See resolved `i:` / `e:` while still updating YAML | **Telescope** |
| Try a one-off body, header, or URL without saving | **Sandbox** |

---

See also: [API tester](./index.md) · [Edit API fields](./edit.md) · [Dynamic values](../../features/dynamic-values/index.md) · [Send an API request](../../tasks/send-api-request.md)
