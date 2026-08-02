# Commands

- run <file>
  - Execute an API, test, suite, or load test file (.yaml/.yml/.json/.mmt)
  - Writes a JSON summary if `--out` is provided
  - Options:
    - `--example <name|#n>` — run a specific named example or numeric index (e.g., `--example happy-path` or `--example #1`)
- print-js <file>
  - Print the generated executable JS for a test file
  - Use this to inspect how a test will run
  - Options:
    - `--example <name|#n>` — print JS for a specific example
- doc <file>
  - Generate documentation from a `type: doc` file (.mmt/.yaml/.yml)
  - Options:
    - `-o, --out <file>` — write output to file (default: `<docname>.html` in the current directory)
    - `--md` — generate Markdown instead of HTML
  - See [Doc](../files/doc/index.md) for authoring `type: doc` files
- version-info
  - Print the CLI and Node.js version
