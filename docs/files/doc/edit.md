# Edit Doc

Open a `type: doc` file in VS Code. The right panel has two pages:

1. **View** — rendered HTML or Markdown preview of aggregated API documentation
2. **Edit Doc** — structured editor for the doc file YAML

## View page

The view header includes preview tabs and an edit launcher:

| Tab | Icon | What you see |
|---|---|---|
| **HTML** | {{btn:code}} | Interactive, searchable HTML documentation |
| **Markdown** | {{btn:markdown}} | Markdown rendering of the doc output |

| Control | What it does |
|---|---|
| {{btn:edit:Edit Doc}} | Switches to edit mode |

The HTML view shows a sticky header (logo, title, search) and expandable API boxes. See [Overview — Elements](./index.md#elements).

## Edit tabs

| Tab | Icon | What you edit |
|---|---|---|
| **Overview** | {{btn:search}} | Title, description, logo, `import`, HTML options, sources, and services |
| **Source** | {{btn:folder-opened}} | Raw `sources` and `services` lists with folder/file pickers |

### Overview

| Field | Notes |
|---|---|
| `title` | Page title in the rendered header |
| `description` | Introductory Markdown shown below the title |
| **Logo** | Image path or URL for the HTML header |
| `import` | Data file imports referenced with `${alias.path}` |
| **HTML Options** | **Triable** toggle — enable Try It controls in the HTML output |
| `sources` | Folders and/or `.mmt` files to scan for `type: api` definitions |
| **Services** | Optional named groups, each with its own sources |

### Source

Alternative editor focused on `sources` and `services` arrays — useful when managing large source lists.

---

See also: [Doc overview](./index.md) · [Quick start](./quick-start.md) · [Markdown output](./markdown.md) · [Reference](./reference.md)
