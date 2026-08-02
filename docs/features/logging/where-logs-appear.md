# Where logs appear

| Entry point | Log destination |
|-------------|----------------|
| **Editor** (run glyph / UI button) | VS Code Output panel → **Multimeter** channel |
| **CLI** (`testlight`) | Terminal stdout |
| **AI assistant** (`@multimeter /run`) | VS Code Output panel → **Multimeter** channel |

In VS Code, open the Output panel (`View → Output`) and select **Multimeter** from the dropdown. The Output panel's built-in log level filter controls which levels are shown.

The CLI prints all levels to stdout. Use `--quiet` to suppress non-error output.
