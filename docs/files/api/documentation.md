# Documentation
The following fields make it easy to search, filter, and auto-document APIs:
- title: API title
- tags: related tags
- description: short explanation of the API (supports Markdown formatting: **bold**, *italic*, `code`, lists, headings, and tables). For multiline descriptions use `|-` (literal block, strip trailing newline).

Sample:
```yaml
type: api
title: generate session
description: |-
  Create a session from **username** and **password**.

  Returns:
  - `token`: JWT session token
  - `expires_in`: token TTL in seconds
tags:
  - smoke
  - authentication
```

### File references in descriptions

A description is automatically recognised as a file reference when it is a single token (no spaces), on one line, and contains `.md#`. The path is resolved relative to the current `.mmt` file.

```yaml
description: README.md#-why-multimeter
```

- In the **editor**, the path is highlighted and Ctrl+click (Cmd+click on macOS) opens the referenced file.
- In the **description preview**, the link is clickable and opens the file.
- In **generated HTML docs**, it renders as a highlighted link.
- In **generated Markdown docs**, it renders as a standard markdown link.
