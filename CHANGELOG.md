# Change Log

All notable changes to the **Multimeter** extension will be documented in this file.

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
