# Get Started

Walk through a first POST request from the Multimeter activity bar.

Use the **Get Started** panel ({{btn:rocket:Get Started}}) after install. It sits under [Temp Files](./temp-files.md) and coaches a simple echo request against [test.mmt.dev](https://test.mmt.dev).

## What you can use it for

- Learn the empty gallery, YAML editor, and **Send** button without reading the full docs first
- Create a temp `.mmt` file and fill a sample POST
- Send, change the body, and send again so the Response panel makes sense
- Come back later with **Reset Get Started** if you want to repeat the walkthrough

## How it works

The panel has two levels: a short welcome, then **Your first request**. Each step has a **How** link. Some How actions fill the file, send the request, or point a coach arrow at the control to click.

| Step | What it does |
|---|---|
| **Create a .mmt file** | Opens a temp file on the empty gallery — also listed in [Temp Files](./temp-files.md) |
| **Write type: api for a POST** | Type the YAML on the left, or let How fill a sample POST to `https://test.mmt.dev/echo` |
| **Send the first POST** | Click **Send**. The response appears on the right |
| **Change the body message** | Edit `message` in the left YAML (not the tester pane) |
| **Send again** | Confirm the new body comes back in the response |
| **Save the file** | Persist the YAML (`Cmd+S` / `Ctrl+S`). Tester-only edits on the right stay temporary until you write them back |

When you finish, the panel offers next steps (docs, GitHub, marketplace).

Command Palette → **Multimeter: Reset Get Started** starts the walkthrough over.

---

## See also

- [Getting Started](../quick-start.md) — install and a first API file
- [Panels](./index.md) — all sidebar and bottom panels
- [Temp Files](./temp-files.md) — scratch drafts from this walkthrough
- [API](../files/api/index.md) — send, inputs, and the tester
