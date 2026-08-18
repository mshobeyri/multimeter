# Temp Files

Keep scratch `.mmt` files without saving them to the workspace.

Use the **Temp Files** panel (first view in the Multimeter activity bar) when you want to try an API, test, or other file type and decide later whether it belongs in the project.

## What you can use it for

- Send a one-off request without creating a file on disk
- Keep several drafts (API, test, suite, …) and reopen them after closing the editor tab
- Pin drafts you reuse, then **Save as File** when they are ready for git

## How it works

- **New MMT file** in this panel opens the empty gallery so you can pick a type or a sample
- Command Palette **New Multimeter File** creates the same kind of temp file
- [Get Started](./get-started.md) also creates a temp file when you begin the first-request walkthrough
- Ctrl/Cmd+click on an inline HTTP step URL also lands here
- Closing the editor tab does **not** delete the draft — it stays in the panel until you remove it
- **Archive** moves the draft into **Archived**. Unarchive it from there to bring it back
- Restarting VS Code restores the list from local extension storage
- The timestamp is when the draft was created; editing it does not change that time

Each row shows the file-type icon and the YAML `title` (or the temp file name). Hover a row for:

| Icon | Action |
|---|---|
| {{btn:archive:Archive}} | Archive the draft and close its editor |
| {{btn:save-as:Save as File}} | Write it into the workspace, then remove it from Temp Files |
| {{btn:pin:Pin}} / {{btn:pinned:Pinned}} | Keep the draft at the top of the list |

In **Archived**, hover for {{btn:unarchive:Unarchive}} only. Section headers fold like Copilot sessions.

Click a row to open it in the Multimeter editor.

## Notes

- Temp files are local to this VS Code profile (not a folder in the project). Opening another workspace keeps the same list.
- Use **Save as File** when you want the draft in git or to import it from another `.mmt` file

---

## See also

- [Getting Started](../quick-start.md) — install and a first request
- [Panels](./index.md) — all sidebar and bottom panels
- [Get Started panel](./get-started.md) — first-request walkthrough in the activity bar
- [API](../files/api/index.md) — send a request from a temp `type: api` file
