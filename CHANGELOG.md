# Change Log

All notable changes to the **Multimeter** extension will be documented in this file.

## [1.34.0]

- Add a Get Started sidebar that walks through a first POST, with a coach arrow on Send, YAML, and the gallery
- Finish onboarding with docs links, **Try again**, community links on every screen, and Storyset credit on Welcome
- Document the YAML/UI split editor and API tester temporary changes (Update YAML / Reset to YAML)
- Fix multi-key `setenv` so one object update applies all keys atomically

## [1.33.2]

- Support multiple CLI presets (`-P` / `--preset`, repeatable or comma-separated) and add short flags (`-F`, `-x`, `-r`, `-R`, `-L`) across CLI, binary, and assistant
- Generate cross-platform curl commands for Bash, PowerShell, and CMD; copy all variants to clipboard when using **Run in Curl**

## [1.33.1]

- Fix suite report clicks: expand/collapse and details no longer blocked by capture-phase handlers
- Click suite tree labels to expand; Ctrl/Cmd+click opens the file
- Reload suite hierarchy before Run and remap targets when node ids change
- Drop `respond` format alias from schema and autocomplete (keep `response`)
- Add regex output sample that captures text before a bracket

## [testlight 0.4.3]

- Improve CLI help: aligned commands/options, run options and examples on the main help screen
- Harden Windows/relative path resolution for `run` and `--env-file` (`../`, `../../`, mixed `/` and `\`)
- Prefer resolving `--env-file` from cwd, then fall back to the `.mmt` file directory
- Add unit tests for nested relative file + env layouts

## [1.33.0]

- Open `.mmt` files in Docker / remote workspaces with the MMT editor (`vscode-remote` / `vscode-vfs`); add **Open as Text** and **Open as MMT** commands
- Style dynamic `i:` / `e:` / `r:` / `c:` tokens with the theme YAML anchor color so they stay readable when selected
- Fix report body text selection and copy (selection no longer wiped by re-renders)
- Replace the marketplace demo GIF with a clickable intro screenshot that opens the YouTube walkthrough
- Tighten Getting Started and Testlight docs navigation
- Build pkg binaries into `bin/<platform>/` only; fix Docker CLI deps and use versionless GitHub release archive names for Testlight downloads

## [testlight 0.4.2]

- Share test call cache across an entire top-level run (suite siblings and nested suites) until TTL expires or the run finishes
- Use versionless GitHub release archive names (`testlight-<platform>.tar.gz|zip`) so `/releases/latest/download/` URLs stay stable
- Improve CLI version handling for packaged binaries

## [1.32.2]

- Stable release of the 1.32.1 suite-wide test call cache fixes

## [1.32.1]

- Share test call cache across an entire top-level run: suite siblings and nested suites reuse the same title + inputs until TTL expires or the run finishes
- Seed the in-run cache when a cached test runs as a suite item so later callers in the hierarchy can hit it

## [1.32.0]

- Add optional test call cache: declare `cache` on a test (duration, epoch, or date/time) so imported calls with the same title + inputs reuse outputs within one root run
- Show dedicated database pass/fail icons when a step is served from cache; add Cache field on the test Edit overview and docs/example
- Stringify objects and arrays for `=C` / `=@` / `=^` / `=$` / `=*` (and related) checks so JSON bodies work as text (e.g. `body =C POST`)
- Support interdependent input defaults across tests and APIs (`i:` / `${inputs…}` among defaults)

## [1.31.3]

- Fix `omit` input removal across request formats (JSON, XML, urlencoded, headers, cookies, query) and test `call` inputs
- Improve omit handling so unquoted `omit` drops fields instead of sending a literal value; quoted `"omit"` stays a string
- Add report integration tests for omit behavior and report levels

## [1.31.2]

- Keep the editor undo history when the UI rewrites YAML, so Ctrl+Z still works after Add example or any UI-driven update
- Fix the API tester auto-format toggle showing off on newly opened files
- Suggest every compare operator (including `=~` / `!~`) in check/assert autocomplete

## [1.31.1]

- Redefine `=~` / `!~` as type-unsafe (as-string) equality for XML/text values vs YAML bools/numbers; regex stays on `=*` / `!*`
- Fix XML output extraction: ignore the XML declaration and comments (no more `body..root`), keep repeated elements as arrays with working indices, and read attributes as plain keys
- Format `md-detailed` report body blocks from Content-Type (json/xml/urlencoded/text) instead of always `json`
- Fix Windows Monaco cursor jumps and undo emptying the editor
- Use the refresh icon for Reset to YAML

## [1.31.0]

- Unify panel UI chrome: shared `TabBar`, `PrimaryButton`, `RunStopToggle`, `PanelRunHeader`, `PanelEditHeader`, and suite `TreeRunButton`
- Harmonize method/semantic accent colors, theme checkboxes, and related button chrome across webviews
- Add string/length compare operators (`=i`/`!i`, `=X`/`!X`, `=iX`/`!iX`, `<#`/`<=#`/`>#`/`>=#`) and fix expect quoting (`"…"` / `'…'`) including bare `omit`
- Support `&&` and `||` in `if` conditions (second clause in the Flow UI)
- Add detailed Markdown report export (`md-detailed`) with Request/Response step details (UI Export + CLI `--report md-detailed`)
- Add YAML-encoded toggle for API edit bodies and pack structured bodies for YAML ↔ UI diffs
- Update flow and no-type step icons (including setenv, HTTP/call, and run→server labels)
- Support JS helper imports without a module binding; open a temporary API file from Ctrl/Cmd+click on HTTP test steps
- Align nested Doc view tabs with the header border; polish env remove icons and mock HTTPS cert file pickers
- Fix Windows CRLF glyph drift and cursor jumps; polish no-type picker labels and keep reports out of the type select list
- Update website roadmap through August 2026

## [1.30.4]

- Stable release of the 1.30.2/1.30.3 fixes (urlencoded token accessors, Windows CRLF body apply, example run glyph alignment, and theme polish)

## [1.30.3]

- Pre-release republish of the 1.30.2 fixes (urlencoded token accessors, Windows CRLF body apply, example run glyph alignment, theme polish)

## [1.30.2]

- Fix urlencoded bodies so `i:` slice accessors and `e:` / `r:` / `c:` tokens survive percent-encoding (including through multilevel imports)
- Fix Windows CRLF leaking into YAML when applying XML/text bodies from the right panel
- Align example run glyphs with the `name:` field (including description-before-name and CRLF layouts)
- Improve theme colors; harmonize accent chrome with theme button tokens
- Style method badges like VS Code buttons

## [1.30.1]

- Fix Windows CRLF breaking YAML `expect` operators (`!=`, etc.) and markdown heading navigation
- Fix urlencoded request bodies so `i:` / `${input}` tokens substitute in tests; keep `&` visible when pretty-printing history
- Fix history panel theme sync so JSON/body highlight colors update with the VS Code theme
- Align body highlight punctuation with theme delimiters (stop using regexp-red `=` / `&`)
- Theme the method selector and body boxes; indent report header/body content without shifting their titles
- Soften `<<i:…>>` token highlight and disable Monaco active-line chrome that showed as intermittent red bars

## [1.30.0]

- Add `urlencoded` and `binary` request body formats (including file picker for binary)
- Support split request/response body formats when they differ
- Highlight urlencoded and XML body values in Monaco
- Support `else` branches for `if` steps in tests
- Preserve `#` comments when formatting `.mmt` YAML (Format Document)
- Colorize history and report/test step bodies by type, with Format/Raw and copy
- Sync Monaco and history syntax colors with the active VS Code color theme
- Fix webview crash while typing incomplete URL schemes (e.g. `url: http:`)
- Isolate UI panel crashes so the YAML editor stays alive
- Stabilize Run/Stop button labels in test, suite, and mock UI

## [1.29.1]

- Stable release of the 1.29.0 features (no-type welcome icons, mock `e:` tokens, fuzzy `>%`/`<%` operators, suite pending/running icons, delay abort, YAML diff for temp UI changes)
- Fix oversized Git icon asset in the marketplace readme

## [1.29.0]

- Redesign the no-type welcome panel: colored type icon row (matching panel title icons), outline badges, and cleaner sample gallery
- Improve response body auto-format handling in the API tester and history panel
- Show a Monaco YAML diff for temporary UI changes (save/reset warning)
- Rename fuzzy percent check operators from `=%` / `!%` to `>%` / `<%` (and `>N%` / `<N%`)
- Support `e:` env tokens in mock servers (responses, match rules, paths, headers, and listen port)
- Fix crash on incomplete `e:` tokens and allow resolving `protocol` from env vars
- Restore suite pending icons for full and partial runs; use tiffany for the running state
- Interrupt long delay steps every 2s so Stop can abort without waiting out the full delay
- Fix Extension marketplace readme issues

## [1.28.4]

- Stable release of the 1.28.3 fixes (API/test temporary UI data for Send/Run, test input conflict dialog and env refresh)

## [1.28.3]

- Fix API Send / Run in Core ignoring temporary tester edits; right-panel runs always prefer UI data (glyphs still use the file)
- Align test panel temporary inputs with API behavior: keep edits across env refresh, gate YAML updates behind the conflict dialog, and show save/reset for dirty inputs

## [1.28.2]

- Fix YAML `!` / `>` expect and check operators (`!=`, `!*`, `operator: !=`, etc.) so they parse and round-trip correctly from code and edit form
- Preserve multi-check expect lists and plain vs explicit `==` values through form editing
- Emit unquoted bang-operators from form serialization (e.g. `!= 201`, `operator: !=`)
- Fix suite partial-run status handling and simplify own-id icons
- Bring back the add example button in the API UI
- Fix overview panel issues
- Stop opening an empty file when clicking the activity bar icon

## [1.28.1]

- Improve history panel icons: red reply for failed responses, mock-server `vm-compact` backdrop matching send/recv colors, and purple WS badge
- Move HTTP API send/response handling into core for shared run results and duration
- Distinguish suite invalid/runtime issues (warning icon) from failed checks; assert failures abort without error popups
- Fix failing tests and clear mmtview lint warnings
- Update agent workflow docs

## [1.28.0]

- Improve API `setenv`: values use the same extraction expressions as `outputs` (paths/regex); referencing an outputs key name remains supported but is deprecated with click-to-fix
- Fix Environment panel variable order (env-file order, then manual adds) and hide empty Presets / Variables titles
- Report missing suite files as `invalid` (warning icon) instead of leaving them pending
- Distinguish run outcomes in logs: check failures (`failed`) vs runtime exceptions (`has error`)
- Fix API `envVariables is not defined` when resolving `e:` tokens during API runs
- Improve suite run lifecycle, duplicate nested-suite handling, and webview report routing
- Log API example expects after Outputs and improve example check UX
- Improve API save/discard and YAML update behavior for request edits
- Fix protocol and method selectors in the API tester
- Show HTTP methods instead of logos in the history panel
- Improve CLI version handling for Testlight

## [1.27.4]

- Add community CTAs on the no-type welcome screen (star the repo, star the extension, send feedback)
- Add per-sample docs and demo links in the sample gallery
- Open an empty untitled `.mmt` (gallery view) from New Multimeter File / activity bar instead of a default API template
- Fix ESLint build warnings in the webview

## [1.27.3]

- Fix webview flash on initial load
- Keep Run, Export, Reload, and related action buttons fixed below panel headers across test, suite, load test, mock, environment, document, and report views
- Move report Export out of the title row into the shared action bar
- Align suite tree item rows and expand chevrons consistently
- Add a Show Preview icon and align document preview/export buttons

## [1.27.2]

- Fix YAML editor tokenizer issues in the `.mmt` editor
- Add sample gallery to the welcome panel for files without a `type`
- Improve history panel UI
- Restore `EXTENSION.md` as the marketplace readme and update the demo GIF
- Update extension display name to "Multimeter – API Testing platform"
- Fix deprecated VS Code chat instruction and prompt metadata
- Deprecate `.mmt` generation in `@multimeter` / `@mmt` chat participants; use Copilot agent mode or Cursor Agent with the Multimeter MCP server instead
- Add fallback model selection for assistant chat requests

## [1.27.1]

- Fix Ctrl+Click navigation for `call:` aliases on Windows (CRLF line endings broke import alias resolution in the editor)

## [1.27.0]

- Add bundled MCP server for GitHub Copilot and AI agents (`read_documentation`, `discover_api`, `validate`, `format`, `run`)
- Add `omit` keyword for removing request fields and expressing missing output values (distinct from `null` and quoted `"omit"`)
- Add suite `items` field as the canonical runner list (`tests` remains supported as a deprecated alias)
- Add click-to-fix compatibility warnings for deprecated suite `tests:` key
- Add combined duration parsing for `repeat` and `delay` (e.g. `1h5m`, `5m3s`)
- Add canonical `.mmt` formatting for env and suite files
- Format multiline `description` fields as `|-` literal blocks
- Improve Bruno, HTTP, Postman, OpenAPI, and import conversion reliability
- Add autocomplete for `+/` path navigation in imports
- Add API test scaffolding helpers for MCP `discover_api` workflows
- Update AI/agent workflow documentation and Copilot prompt instructions
- Fix root test function name collisions when a title matches an imported file basename
- Fix input accessor interpolation (`i:` slices) in imported API call bodies
- Fix check/assert access to default call outputs (`body`, `status`, etc.) without explicit output maps
- Fix omit handling in check/assert comparisons and report output display
- Fix crashes when typing partial `call:`/`http:` URLs in test steps
- Fix crashes on malformed test-step YAML during flowchart rendering
- Fix Ctrl+Click (Cmd+Click on macOS) navigation for call aliases in the editor
- Strip invalid characters from generated JS function names during conversion
- Improve JSer error handling and reporting
- Remove red highlight box from autocomplete suggestions

## [1.26.0]

- Add extension README/metadata support via `EXTENSION.md`
- Fix API response handling so response body is returned even when a request errors
- Fix status bar API test creation when `api-test.mmt` already exists by auto-incrementing duplicate filenames


## [1.25.1]
 - Fix bug
 - Add mmt fast mode in status bar 


## [1.25.0]

- Prepare pre-release packaging and metadata updates
- See commit history for full details


## [1.24.5]

- Add data imports from `.json`, `.yaml`, `.yml`, and `.csv` across all file types
- Resolve `${alias.path}` references in API runs, environment files, suites, and the UI
- Add autocomplete for data import paths and imported field references
- Move import editing into Overview tabs for suite and environment editors
- Refactor certificate handling

## [1.24.4]

- Fix mTLS certificate resolution for nested env files and VS Code runs
- Add a public external mTLS example and improve network handling
- Remove unused code

## [1.24.3]

- Add Cursor editor support files
- Add additional fix for the latest release

## [1.24.2]

- Show output only for glyph-triggered runs
- Add configuration and HTTP version support
- Add manual timeout support
- Improve curl command handling
- Fix reported error line handling
- Fix mTLS handling
- Fix star token handling

## [1.24.1]

- Refactor certificate flows and related handling
- Update documentation content
- Update website CSS animation behavior
- Remove UI testing content from the website

## [1.24.0]

- Add option-selection support in UI interactions and response/message body parsing updates
- Rename the default workspace environment file to `multimeter.mmt`
- Fix Windows path handling and packaging reliability issues
- Improve website slider active-state behavior
- Refresh project licensing metadata and clean up incorrectly committed assets

## [1.23.0]

- Export API outputs by default, including `body`, `headers`, `cookies`, `status`, and `duration`
- Improve certificate handling and examples, and refresh self-signed certificate documentation
- Refine mock server UX with a dedicated status bar entry and UI improvements
- Show reported count values for `=#` and `!#` comparisons alongside fuzzy similarity details
- Fix split panel sync and transient page jump issues, and refresh README and website content

## [1.22.1]

- Fix certificate matching and loading for mTLS, including wildcard and `host:port` host patterns plus file-run certificate toggle handling
- Fix array handling and preserve `null` placeholders for missing values
- Refresh README, contribution, and license/project metadata

## [1.22.0]

- Redefine the convertor as a VS Code native flow and add WSDL support
- Update the OpenAPI sample and refresh README content

## [1.21.1]

- Add support for `.bruno` files across parsing and editor flows
- Remove the red outline from auto-complete suggestions
- Update extension keywords for Bruno and `.http` discovery

## [1.21.0]

- Add Bruno file support, examples, and import flows
- Add `.http` file support, inline HTTP calls, and curl paste conversion
- Add fuzzy comparison support and report-all handling improvements
- Improve flowchart, demo/tutorial, and website navigation behavior
- Update docs, roadmap, and sample content for the new request-file workflows

## [1.20.0]

- Add flowchart views for tests and suites
- Render imported tests as nested test boxes inside flowcharts
- Improve flowchart layout, edge routing, refresh behavior, and click navigation
- Align flowchart step icons and names with the test editor
- Update flowchart design notes and website content

## [1.19.1]

- Fix documentation generation for current-folder sources
- Update Testlight release metadata and website download copy

## [1.19.0]

- Add `loadtest` file support with reporting and validation
- Add test UI plus suite and load test overview improvements
- Improve test execution by compiling tests once and updating worker execution
- Refine report, suite, and load test UI and report schema handling
- Fix load testing logs, report issues, full screen button behavior, and server-related issues
- Update docs and website

## [1.18.0]

- Add temporary API change warning with preview, save, and discard actions in the API tester UI
- Canonicalize API, suite, and mock YAML output to avoid unwanted empty `title` fields and preserve mock WebSocket messages
- Improve website community links and replace the demos page with a YouTube playlist-driven experience

## [1.17.2]

- Fix doc source `.` (current folder) not matching any files

## [1.17.1]

- Fix `contain` and `is in` operator issues
- Fix empty import issue
- Update website

## [1.17.0]

- Make API `format` field optional with default of `json`
- Add `xmle` format support (expanded XML with explicit closing tags)
- Fix auto complete and UI modify behavior of operators
- Fix `e:` token handling issue

## [1.16.2]

- Fix environment variable extraction issue
- Update website

## [1.16.1]

- Improve assistant behavior and prompt handling
- Add GraphQL and gRPC protocol support with dedicated UI tabs and sample assets
- Add auth support to API definitions
- Improve variable parsing and environment selection
- Fix multi-item run handling and file discard issues

## [1.16.0]

- Add debug mode
- Add progress of mmt test in task bar
- Add open in new tab mode
- Show error for inputs that are not valid
- Show error for invalid data in tests
- Show invalid tests as invalid in suite run
- Fix the selected space in imports issues
- Fix regex validation issue
- Fix report UI
- Add expect items to be shown in one item
- Update docs for preventing YAML comments

## [1.15.2]

- Stable release of 1.15.1 fixes

## [1.15.1]

- Fix stage issues
- Fix WebSocket type handling
- Fix environment example and other example updates

## [1.15.0]

- Show compile errors instead of running code
- Potential fix for parallel run
- Add unit tests
- Remove import of APIs
- Update examples

## [1.14.6]

- Finalize the 1.14.6 release metadata and changelog

## [1.14.5]

- Fix XML rendering and report box issues
- Add and refine the real example project
- Fix root path handling issues
- Add Playwright basics example

## [1.14.4]

- Refresh the website for the open source launch, including BSL licensing and updated messaging
- Improve the website hero, reports, comparison, FAQ, and release/download presentation
- Fix packaging/build issues and follow-up CLI issues after the last release
- Update release metadata and supporting docs

## [1.14.3]

- Add npm package distribution
- Expand docs and examples, including suite and mock server samples
- Add an open action for exported report types
- Fix suite parallel execution, panel sizing, imported item titles, and environment variable handling during tests

## [1.13.0]

- Add `environment` field for suite files to configure presets, env files, and inline variables
- Add `export` field for suite files to auto-generate reports (JUnit XML, HTML, Markdown, MMT) after suite completion
- Add overview section showing pass/fail/skip counts for tests and suites
- Add duration tracking in reports
- Add report format toggle (formatted/raw JSON)
- Add server type support in tests (`run` step can start mock servers)
- Improve suite UI with 4-tab edit panel (Tests, Servers, Environment, Exports)
- Improve report display and naming
- Fix suite hierarchy issues
- Fix mock server startup issues
- Various UI refinements

## [1.12.1]

- Fix custom editor not loading on Windows due to filenamePattern selector issue

## [1.12.0]

- Add inline check and assert fields on call steps
- Add structured report display for call check/assert results (status code, inputs, outputs, request, response)
- Add Format/Raw toggle button for JSON body fields in report details
- Add support of dot notation as default output extractor
- Parse object and array values in output extraction
- Handle empty values in check comparisons
- Fix duplicate call alias generating invalid code

## [1.11.0]

- Add test stop button
- Add warning for description fields missing block scalar indicator
- Add validation for inputs and environment variables in YAML
- Unify test and suite UI buttons
- Activate horizontal sliders for responsive UI
- Refine logs

## [1.10.0]

- Add support for markdown in descriptions
- Refine extract variable from output
- Add option to auto-collapse long description sections
- Make API outputs copyable
- Reorder sub items by format

## [1.9.4]

- Add copy button for API output values
- Reorder sub items by format in the editor

## [1.9.3]

- Add a button to temporarily modify HTTP method
- Website launch with interactive demos and comparisons

## [1.9.2]

- Add auto complete for call step inputs
- Add input and output documentation
- Fix doc edit mode issues
- Fix multistage execution issue
- Fix imported items input validation
- Refine check step and call UI

## [1.9.1]

- Add input and output support for tests
- Add try ability to API documentation
- Add CORS support for mock server
- Fix CSV import issues
- Fix environment variable handling
- Fix WebSocket related issues

## [1.8.1]

- Add and delete functionality for environment variables
- Add option to show a panel as default
- Move default location of environment panel to bottom

## [1.8.0]

- Enhance report functionality

## [1.7.4]

- Fix showing connect button issue
- Improve test report box layout

## [1.7.3]

- Add connection tracking panel
- Handle naming of setenv variables
- Update variable replacer to handle environment inputs
- Fix CSV file reading issue
- Fix close connection issue

## [1.7.2]

- Add ability to run external code in tests
- Add setenv step for tests
- Fix code view issue
- Fix environment variables issue

## [1.7.1]

- Add mock server history
- Improve mock server UI
- Add HTTPS certificate support
- Fix suite run issues

## [1.7.0]

- Redesigned API, test, suite, and environment panels
- Show WebSocket statuses and support arbitrary protocols
- Add `+/` feature for importing files from project root
- Make presets a table layout
- Move certificates to environment panel
- Support setting env file from configs

## [1.6.1]

- Fix issue with printing details
- Fix glyph send issue

## [1.6.0]

- Add `report_success` field to check and assert steps

## [1.5.3]

- Refactor suite internals
- Fix suite issues and stop icon

## [1.5.2]

- Add YAML font size as a setting parameter
- Fix issue with parallel run reports
- Fix issue with "add as output variable"

## [1.5.1]

- Use titles and icons for suite items
- Handle not showing groups that are single in the UI
- Rename expected/actual to left/right

## [1.5.0]

- Suite bundle runner: redesigned execution model with hierarchy and grouping
- Suite items run in parallel within groups
- Add cancel step and report section for suites
- Show test items as boxes in suite view
- Separate suite into two tabs
- Add input auto complete
- Rename check and assert elements
- Add check and assertion auto complete items

## [1.4.3]

- Fix Windows add-file issue
- Fix relative import of suite issue

## [1.4.2]

- Fix Windows path handling
- Fix glyph run issue
- Fix underscores as function postfix issue
- Separate log panel opening logic

## [1.4.1]

- Add suite to type options
- Remove imports prefix for imported items
- Fix assert and check message issues

## [1.4.0]

- Add "add item" to the suite panel
- Change check and assert format
- Add callback for reporting tests
- Handle Ctrl+Click navigation in a general way
- UI improvements for check and assert second mode
- Import tracker for better file resolution
- Break JSer into multiple modules
- Handle importing recursive files

## [1.3.0]

- Add suite type with autocomplete and live status
- Add OS file picker for suite items, imports, and doc elements
- Add file-missing warnings for doc and suite
- Load suite status live
- Refactor extension into separate modules (assistant, mmtAPI, panels)
- Add AI documentation

## [1.2.3]

- Fix build issue

## [1.2.2]

- Fix assistant issue
- Fix setting env file issue for CLI
- Fix CLI issues

## [1.2.1]

- Enable body for GET requests
- Fix send button busy position
- Improve UI of API tester
- Fix certificates UI
- Fix auto update issues with docs

## [1.2.0]

- Test certificates and handle self-signed certificates
- Improve UI
- Fix connect button issue
- Fix format issues with file elements

## [1.1.0]

- Add and remove parameters from UI
- Add input validator for YAML editor
- Handle passing example name or id to runner
- Update autocomplete
- Drag and drop improvements
- Refactor environment variables UI
- Improve API tester UI

## [1.0.3]

- Add presets to environment variable tab
- Show errors at file level and warnings for missing imports
- Handle passing query params
- Refine log levels of API test

## [1.0.2]

- Fix environment variable issue of tests
- Fix XML format issue
- Fix markdown preview size issue
- Update runner to support manual inputs

## [1.0.1]

- Add format document feature
- Fix issues with updating inputs and examples
- Handle showing choose-type page for invalid YAML
- Rename `expected` in examples to `outputs`
- Handle running API with environment variables

## [1.0.0]

- Handle showing errors in tests properly
- Proper HTTP error messages
- Run examples from the UI
- Run API tests from glyph
- Add "add as output variable" feature
- Full screen mode for body view
- Enable find for `.mmt` files
- Stages UI for test flow
- Curl support
- AI assistant for running tests and APIs
- Handle conditions in tests
- Markdown format for docs
- Improve docs UI and HTML export

## [0.29]

- Separate resources from code for panels

## [0.28]

- Disable `type: var`

## [0.27]

- Distinguish different HTTP response ranges (not only 200 as success)
- Merge extract and outputs
- Make overview page support input/output
- Fix issues with number and boolean in output
- Fix issues with objects in tests

## [0.26.1]

- Fix formatting issues

## [0.26]

- Improve UI and toolbar (always visible toolbar)
- Use VEditor for input/outputs
- Add auto format button in status bar
- Consider outputs for examples
- Add status code and response time in output
- AI agent basics (Multimeter assistant)
- Add AI test generation sample profile
- Add description field for tests

## [0.25]

- Postman converter: handle examples, random variables, environment variables
- Add random generator functions
- Add current variables support
- Make headers blockable
- Move converter logic to core

## [0.24]

- Support WebSocket in tests
- Add try button for mock server
- Mock server improvements
- Add demos and README updates

## [0.23]

- Refactor TestFlow UI
- Fix issues with packaging imported APIs

## [0.22]

- Add Markdown support in docs
- Testlight CLI version 0.3
- Fix issues with variables in URL

## [0.21]

- Add doc type with expandable API docs and HTML export
- Add search box for document
- CLI support exporting document
- Add test auto complete
- Improve doc view and UI
- Testlight CLI version 0.2

## [0.20]

- Add testlight documentation
- Add history panel, converter, and mock server documentation
- Rename CLI binary to `testlight`
- Add delay step for tests
- Add environment variable replacer with `<e:VAR>` syntax
- CLI: add `-i`/`-e` pair parsing with type coercion
- Pass env variables from storage to code

## [0.19]

- Introduce test flow visual editor with drag and drop
- Add tree view for test items (call, check, assert, set, let, var, const, print, js)
- Introduce CLI app (`multimeter-cli` / `testlight`)
- Support CSV file data for tests
- Move core logic to `mmt-core` package
- Separate network layer and refactor
- Add cookies support
- Introduce stages and steps
- Add JSer (`.mmt` to JavaScript compiler)
- Ctrl+Click to open files
- Extensive unit tests for core modules

## [0.18]

- Implement reflect HTTP in mock server
- Fix duration display issue
- Refresh API page when environment variables change from panel

## [0.17]

- Update README with GIF demos

## [0.16.1]

- Fix refresh API issue
- Refactor network layer
- Make import, input, and output objects
- Add ability to modify env vars from panel

## [0.16]

- Add field extract and keep output for API signature
- Update auto complete

## [0.15]

- Add environment variable suggestions in auto complete

## [0.14]

- Light theme support
- OpenAPI converter
- UI theme improvements

## [0.13]

- Add auto format setting
- Fix env editor UI issue

## [0.12]

- Add show history command
- Update variable highlighter
- Save environment variables with their types

## [0.11]

- Update API schema and UI
- Add view mode persistence
- Postman converter updates
- Handle random variables
- Validate YAML schemas and environment files
- Add type suggestions and autocomplete for API

## [0.10]

- Add request timeout setting
- Add request cancel button
- Show request duration
- Refactor variable replacer

## [0.9]

- Define `mmt` language
- Add view mode buttons (text editor / visual editor)
- Handle certificates
- Add environment variable panel

## [0.8]

- Add certificate panel
- Add setenv type for setting environment variables from response
- Extract outputs from API responses
- Add filter view in API tester
- Improve history panel (compare mode, clear/reset env)
- Use codicons throughout the UI
- Fix XML regex extraction

## [0.7]

- Add mock server (HTTP and WebSocket)
- Support XML path extraction
- Support output variables
- Add Postman converter
- Variable highlighting with `<>` syntax
- Add history panel
- Add converter panel

## [0.5]

- Initial release
- YAML-based API editor
- HTTP and WebSocket request support
- Environment variables and presets
- Body view with syntax highlighting
- Split panel editor
- Examples support
