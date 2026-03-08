import { loadEnvVariables } from '../workspaceStorage';
import { JSONValue } from 'mmt-core/CommonData';
import { Random, Current } from 'mmt-core';

export const KeySuggestionsByParent = (monaco: any) => {
    const variablesSuggestions: any[] = [];

    // Dynamic random token suggestions sourced from Random.RANDOM_TOKEN_MAP (single source of truth)
    const randomTokenSuggestions = Object.keys(Random.RANDOM_TOKEN_MAP)
        .sort()
        .map(name => ({
            label: 'r:' + name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: ' r:' + name,
            detail: `Random ${name} value`,
            documentation: `Generates a random ${name} at runtime. Token form r:${name}.`
        }));
    variablesSuggestions.push(...randomTokenSuggestions);

    // Dynamic current token suggestions sourced from Current.CURRENT_TOKEN_MAP
    const currentTokenSuggestions = Object.keys(Current.CURRENT_TOKEN_MAP)
        .sort()
        .map(name => ({
            label: 'c:' + name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: ' c:' + name,
            detail: `Current ${name} value`,
            documentation: `Inserts current ${name} at runtime. Token form c:${name}.`
        }));
    variablesSuggestions.push(...currentTokenSuggestions);

    loadEnvVariables((variables: { name: string; label: string; value: JSONValue }[]) => {
        variablesSuggestions.push(...variables.map(envVar => ({
            label: 'e:' + envVar.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: ' e:' + envVar.name,
            documentation: envVar.label || `Environment variable: ${envVar.name}`,
            detail: `${envVar.name}: ${envVar.value || 'undefined'}`,
        })));
    });

    const rootSuggestions = [
        {
            label: "type",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "type: ",
            detail: 'Type of mmt file [api, env, doc, test, suite, server, report]',
            documentation: 'Type of mmt file, must be one of: api, env, doc, test, suite, server, report\n\t- api: Define an API\n\t- env: Define environment variables\n\t- doc: Define a documentation page (title/description/sources/theme)\n\t- test: Define a test suite (steps/stages)\n\t- suite: Orchestrate multiple .mmt files in groups split by "then"\n\t- server: Define a mock server\n\t- report: Test/suite run results\nExample: type: suite',
        }];

    const typeSuggestions = [
        {
            label: "API",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " api",
            detail: 'Define an API',
            documentation: 'WS, HTTP, or other API definitions. This is the main type for defining APIs in MMT',
        },
        {
            label: "Environment variables",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " env",
            detail: 'Define environment variables',
            documentation: 'Environment variables used across multiple APIs. This allows you to define reusable variables that can be referenced in API definitions',
        },
        {
            label: "Doc",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " doc",
            detail: 'Define a documentation page',
            documentation: 'Documentation definition that aggregates APIs into a styled page. Supports title, description, sources/files/folders, and theme (logo/colors).',
        },
        {
            label: "Test",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " test",
            detail: 'Define a test suite',
            documentation: 'Test definition using steps or stages. Supports steps like call, data, check, assert, if/for/repeat, delay, js, print, set, var, const, let, setenv. The top-level import section supports importing other .mmt tests/APIs/CSV; it can also import .js/.cjs/.mjs helper modules and bind them to an alias.',
        },
        {
            label: "Suite",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " suite",
            detail: 'Define a suite runner',
            documentation: 'Suite definition that runs referenced .mmt files. Uses tests: [path | then | path], runs items in a group in parallel and groups sequentially.',
        },
        {
            label: "Server",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " server",
            detail: 'Define a mock server',
            documentation: 'Local mock server with configurable endpoints, route matching, conditional responses, and dynamic tokens. Supports HTTP, HTTPS, and WebSocket protocols.',
        },
        {
            label: "Report",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " report",
            detail: 'Test/suite run results',
            documentation: 'Report file generated from test or suite runs. Contains summary (tests, passed, failed, errors, skipped), timestamp, duration, and per-suite/test step results.',
        },
    ]
    const testSuggestions = [
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'Test title [string]',
            documentation: 'A descriptive title for the test suite.'
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'Test description [string]',
            documentation: 'Optional description shown under the title.'
        },
        {
            label: "tags",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tags:\n\t- ",
            detail: 'Test tags [array of strings]',
            documentation: 'Tags for categorizing tests.'
        },
        {
            label: "import",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "import:\n\t",
            detail: 'Import external parameters [object of key: value]',
            documentation: [
                'Import map used in this test (alias -> path).',
                'Supports importing other .mmt files (test/api/csv) and also JS helper modules by extension (.js/.cjs/.mjs).',
                'Examples:',
                'import:',
                '  common: ./common.test.mmt',
                '  helpers: ./helpers/myHelpers.js',
                '',
                'Then in steps JS you can call: helpers.someFn()',
            ].join('\n')
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n\t",
            detail: 'Input variables [object]',
            documentation: 'Input variables available to steps.'
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n\t",
            detail: 'Output variables [object]',
            documentation: 'Values produced by the test to be reused.'
        },
        {
            label: "steps",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "steps:\n\t",
            detail: 'Linear steps [array]',
            documentation: 'Define a sequence of steps (call, data, check, assert, if, for, repeat, delay, js, print, set, var, const, let, setenv).'
        },
        {
            label: "stages",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "stages:\n\t",
            detail: 'Stage-based steps [array]',
            documentation: 'Define named stages with their own steps and optional dependencies.'
        },
    ];

    const suiteSuggestions = [
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'Suite title [string]',
            documentation: 'A descriptive title for the suite.',
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'Suite description [string]',
            documentation: 'Optional description shown under the title.',
        },
        {
            label: "tags",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tags:\n\t- ",
            detail: 'Suite tags [array of strings]',
            documentation: 'Tags for categorizing suites.',
        },
        {
            label: "servers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "servers:\n\t- ",
            detail: 'Suite servers [array]',
            documentation: 'List of mock server .mmt file paths to start before the suite runs and keep running throughout.',
        },
        {
            label: "tests",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tests:\n\t- ",
            detail: 'Suite items [array]',
            documentation: 'List of .mmt paths and the literal "then" barrier. Items in a group run in parallel; groups run sequentially.',
        },
    ];
    const reportSuggestions = [
        {
            label: "name",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "name: ",
            detail: 'Report name [string]',
            documentation: 'Name of the report. Defaults to the suite path or "multimeter".',
        },
        {
            label: "timestamp",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "timestamp: ",
            detail: 'Run timestamp [ISO 8601]',
            documentation: 'ISO 8601 timestamp of when the run started.\nExample: timestamp: 2026-03-07T08:04:43.553Z',
        },
        {
            label: "duration",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "duration: ",
            detail: 'Total duration [string]',
            documentation: 'Total run duration in seconds.\nExample: duration: 1.234s',
        },
        {
            label: "summary",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "summary:\n\ttests: \n\tpassed: \n\tfailed: \n\terrors: \n\tskipped: ",
            detail: 'Results summary [object]',
            documentation: 'Aggregate counts: tests, passed, failed, errors, skipped.',
        },
        {
            label: "cancelled",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cancelled: true",
            detail: 'Whether run was cancelled [boolean]',
            documentation: 'Set to true if the run was cancelled before completion.',
        },
        {
            label: "suites",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "suites:\n\t- name: \n\t  result: \n\t  tests:\n\t    - name: \n\t      type: \n\t      result: ",
            detail: 'Suite entries [array]',
            documentation: 'List of suite/test-run entries. Each has name, optional file, duration, result, and a tests array of step results.',
        },
    ];
    const stepsSuggestions = [
        {
            label: "call",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- call: ",
            detail: 'Call an API by name',
            documentation: [
                'Executes an API and optionally captures its result.',
                'Fields:',
                '  - id: optional variable name to assign the output',
                '  - inputs: overrides for API inputs',
                '  - check: inline check on output parameters',
                '  - assert: inline assert on output parameters (stops on failure)',
                '  - report: report level for inline checks/asserts',
                'Example:',
                '- call: get_user',
                '  id: user',
                '  inputs:',
                '    userId: "u-123"',
                '  check: status == 200',
                'Note: Outputs returned by the API include mapped fields plus status_code and response_time.'
            ].join('\n')
        },
        {
            label: "data",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- data: ",
            detail: 'Load data resource',
            documentation: [
                'Loads a data alias (CSV/JSON) for use in steps.',
                'Example:',
                '- data: users.csv',
                '  id: users',
                'Then use in JS: users[0].email'
            ].join('\n')
        },
        {
            label: "check",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- check: ",
            detail: 'Check expression',
            documentation: [
                'Evaluates a boolean condition and logs an error if false.',
                'Supported operators: <, >, <=, >=, ==, !=, =@, !@, =~, !~, =^, !^, =$ , !$',
                'Env tokens: use e:NAME or <<e:NAME>> which resolve to envVariables.NAME',
                'Examples:',
                '- check: response.status_code == 200',
                '',
                '# Object form:',
                '- check:',
                '    actual: response.status_code',
                '    expected: 200',
                '    operator: "=="',
                '    title: "Unexpected status"',
                '    details: "Status code should be 200"',
                '    report: all  # or: fails, none, or object with internal/external'
            ].join('\n')
        },
        {
            label: "assert",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- assert: ",
            detail: 'Assert expression',
            documentation: [
                'Evaluates a boolean condition and throws if false (fails the test).',
                'Same operators as check.',
                'Examples:',
                '- assert: total_users >= 1',
                '',
                '# Object form:',
                '- assert:',
                '    actual: total_users',
                '    expected: 1',
                '    operator: ">="',
                '    title: "User count too low"',
                '    details: "Expected at least one user"',
                '    report: all  # or: fails, none, or object with internal/external'
            ].join('\n')
        },
        {
            label: "if",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- if: ",
            detail: 'Conditional block',
            documentation: [
                'Runs nested steps only when the condition is true. Optional else with its own steps.',
                'Example:',
                '- if: user.role == `admin`',
                '  steps:',
                '    - print: "Admin access granted"',
                '  else:',
                '    - print: "Limited access"'
            ].join('\n')
        },
        {
            label: "for",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- for: ",
            detail: 'Loop over collection',
            documentation: [
                'Executes nested steps for each item in an iterable.',
                'Use native JS for clause.',
                'Example:',
                '- for: const user of users',
                '  steps:',
                '    - print: Hi'
            ].join('\n')
        },
        {
            label: "repeat",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- repeat: ",
            detail: 'Repeat steps N times or for duration',
            documentation: [
                'Repeats nested steps a fixed number of times, or for a duration.',
                'Count example:',
                '- repeat: 3',
                '    steps:',
                '        - print: "loop"',
                'Duration example (supports ns, ms, s, m, h):',
                '- repeat: 2s',
                '    steps:',
                '        - call: ping'
            ].join('\n')
        },
        {
            label: "delay",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- delay: 1000",
            detail: 'Delay in time units',
            documentation: [
                'Pauses execution. Accepts number (ms) or duration with units ns|ms|s|m|h.',
                'Examples:',
                '- delay: 500',
                '- delay: 1.5s'
            ].join('\n')
        },
        {
            label: "js",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- js: ",
            detail: 'Run JavaScript',
            documentation: [
                'Executes inline JavaScript in the test context.',
                'Access variables, envVariables, and prior step outputs.',
                'Example:',
                '- js: total = users.length'
            ].join('\n')
        },
        {
            label: "print",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- print: ",
            detail: 'Print message',
            documentation: [
                'Logs a message for debugging.',
                'Template strings supported.',
                'Example:',
                '- print: Hi'
            ].join('\n')
        },
        {
            label: "set",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- set: ",
            detail: 'Set variables',
            documentation: [
                'Assign values to existing variables.',
                'Example:',
                '- set:',
                '    response_time: 0'
            ].join('\n')
        },
        {
            label: "var",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- var: ",
            detail: 'Define variables',
            documentation: [
                'Declare variables available to subsequent steps. Strings are template-enabled; objects and numbers are inserted directly.',
                'Examples:',
                '- var:',
                '    baseUrl: `https://api.example.com`',
                '    threshold: 10'
            ].join('\n')
        },
        {
            label: "const",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- const: ",
            detail: 'Define constants',
            documentation: [
                'Declare immutable values for the test context.',
                'Example:',
                '- const:',
                '    roles: [`admin`, `user`]'
            ].join('\n')
        },
        {
            label: "let",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- let: ",
            detail: 'Define lexical variables',
            documentation: [
                'Declare mutable values in the test context.',
                'Example:',
                '- let:',
                '    counter: 0'
            ].join('\n')
        },
        {
            label: "setenv",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- setenv:\n\t",
            detail: 'Set environment variables',
            documentation: [
                'Promotes values to environment variables at runtime.',
                'Only takes effect when running the test directly (not when imported).',
                'Example:',
                '- setenv:',
                '    TOKEN: ${login.token}',
                '    USER_ID: ${user.id}'
            ].join('\n')
        },
        {
            label: "run",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- run: ",
            detail: 'Start a mock server',
            documentation: [
                'Starts a mock server from a .mmt server file.',
                'The server runs for the duration of the test and stops automatically.',
                'Example:',
                '- run: ./mocks/user-service.mmt',
                '',
                'The path is relative to the test file.'
            ].join('\n')
        },
        {
            label: "id",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "- id: ",
            detail: 'Optional step identifier',
            documentation: [
                'Identifier to capture a step result or refer to a stage.',
                'Example (call capture):',
                '- call: get_user',
                '  id: user'
            ].join('\n')
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n\t",
            detail: 'Inputs for step',
            documentation: [
                'Key-value inputs specific to a step (commonly for call).',
                'Non-string inputs are injected without extra quoting.',
                'Example:',
                '- call: add_item',
                '  inputs:',
                '    count: 2',
                '    note: `hello`'
            ].join('\n')
        },
        {
            label: "steps",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "steps:\n\t",
            detail: 'Nested steps',
            documentation: [
                'Container for nested steps inside control-flow constructs like if/for/repeat and stages.',
                'Example:',
                '- if: total > 0',
                '  steps:',
                '    - print: Hi'
            ].join('\n')
        },
    ];
    const stageSuggestions = [
        {
            label: "id",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "id: ",
            detail: 'Stage identifier',
            documentation: [
                'Unique name for the stage. Used for dependencies and internal promises.',
                'Example:',
                '- id: prepare'
            ].join('\n')
        },
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'Stage title',
            documentation: [
                'Human-friendly title shown in docs or logs.',
                'Example:',
                '- title: Prepare test data'
            ].join('\n')
        },
        {
            label: "condition",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "condition: ",
            detail: 'Conditional expression',
            documentation: [
                'Only runs the stage when the condition is true; otherwise returns early.',
                'Supports the same operators and env tokens as check/assert.',
                'Example:',
                '- condition: e:RUN_PREP == true'
            ].join('\n')
        },
        {
            label: "depends_on",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "depends_on: ",
            detail: 'Stage dependencies',
            documentation: [
                'Single name or list of stage names that must finish before this stage starts.',
                'Example:',
                '- depends_on: prepare',
                'or',
                '- depends_on:',
                '  - prepare',
                '  - seed'
            ].join('\n')
        },
        {
            label: "steps",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "steps:\n\t",
            detail: 'Stage steps',
            documentation: [
                'Steps executed in this stage. Stages run concurrently by default and are synchronized by depends_on.',
                'Example:',
                '- steps:',
                '  - call: get_user'
            ].join('\n')
        },
    ];
    const docSuggestions = [
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'Doc title [string]',
            documentation: 'Title of the documentation page. Shown at the top.'
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'Doc description [string]',
            documentation: 'Optional description shown under the title.'
        },
        {
            label: "sources",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "sources:\n\t- ",
            detail: 'List of .mmt files or folders [array of strings]',
            documentation: 'Files or folders to scan for API definitions. Folders are scanned recursively.'
        },
        {
            label: "services",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "services:\n\t- name: \n\t  description: \n\t  sources:\n\t    - ",
            detail: 'Service groups [array]',
            documentation: 'Optional grouping of sources by service. Each item has name, optional description, and sources (folders or files).'
        },
        {
            label: "logo",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "logo: ",
            detail: 'Logo URL/path [string]',
            documentation: 'Path or URL to a logo image shown next to the title.'
        },
        {
            label: "html",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "html:\n\ttriable: true",
            detail: 'HTML output options [object]',
            documentation: 'Options for the generated HTML doc page. Enable triable to add interactive "Try" buttons for testing endpoints directly from the browser (like Swagger Try It Out).'
        },
        {
            label: "env",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "env:\n\t",
            detail: 'Environment variables [object]',
            documentation: 'Key-value pairs that resolve e:key placeholders in URLs, headers, bodies, and descriptions across all API endpoints.\nExample:\nenv:\n  url: http://localhost:8080\n  token: my-secret-token'
        }
    ];
    const apiSuggestions = [
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'API title [string]',
            documentation: 'A descriptive title for your API. This helps identify and organize your APIs.\nExample: title: User Management API',
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'API description [string]',
            documentation: 'A detailed description of what this API does, its purpose, and usage notes.\nExample: description: This API handles user authentication and profile management',
        },
        {
            label: "tags",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tags:\n\t- ",
            detail: 'API tags [array of strings]',
            documentation: 'Tags for categorizing and organizing APIs. Helps with searchability and filtering.\nExample:\ntags:\n\t- user\n\t- authentication\n\t- v1',
        },
        {
            label: "import",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "import:\n\t",
            detail: 'Import external parameters [object of key: value]',
            documentation: 'Import parameters from external sources or other API definitions. Allows reusing common parameters across multiple APIs.\nExample:\nimport:\n\tbaseUrl: "{{env.API_BASE_URL}}"\n\tauthToken: "{{env.AUTH_TOKEN}}"',
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n\t",
            detail: 'Input parameters [object of key: value]',
            documentation: 'Define input parameters that can be used throughout the API definition. These are variables that can be referenced in URLs, headers, and body.\nExample:\ninputs:\n\tuserId: "123"\n\tapiKey: "{{env.API_KEY}}"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n\t",
            detail: 'Output parameters [object of key: value]',
            documentation: 'Define how to extract values from API responses as output parameters. These extracted values can be used in subsequent requests or stored as environment variables.\nExample:\nextract:\n\tuserId: "$.data.user.id"\n\ttoken: "$.data.access_token"',
        },
        {
            label: "setenv",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "setenv:\n\t",
            detail: 'Set environment variables [object of key: value]',
            documentation: 'Map output values to environment variables that can be used in other APIs. Links extracted outputs to environment variable names.\nExample:\nsetenv:\n\tUSER_ID: "userId"\n\tACCESS_TOKEN: "token"',
        },
        {
            label: "protocol",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "protocol: ",
            detail: 'Communication protocol [http, ws] (optional)',
            documentation: 'The protocol used for communication (optional - inferred from URL if not specified).\nOptions:\n\t- http: Standard HTTP/HTTPS requests (default)\n\t- ws: WebSocket connections\nNote: If URL starts with ws:// or wss://, protocol defaults to ws.\nExample: protocol: http',
        },
        {
            label: "method",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "method: ",
            detail: 'HTTP method [get, post, put, patch, delete, head, options, trace]',
            documentation: 'The HTTP method for the request. Defines the type of operation to perform.\nOptions:\n\t- get: Retrieve data\n\t- post: Create new resource\n\t- put: Update entire resource\n\t- patch: Partial update\n\t- delete: Remove resource\n\t- head: Get headers only\n\t- options: Get allowed methods\n\t- trace: Debug request path\nExample: method: post',
        },
        {
            label: "format",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "format: ",
            detail: 'Data format [json, xml, text]',
            documentation: 'The format of the request and response data. Determines how the body content is parsed and serialized.\nOptions:\n\t- json: JavaScript Object Notation\n\t- xml: Extensible Markup Language\n\t- text: Plain text format\nExample: format: json',
        },
        {
            label: "url",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "url: ",
            detail: 'Endpoint URL [string]',
            documentation: 'The complete URL or URL template for the API endpoint. Can include variables using {{variable}} syntax.\nExample: url: "{{baseUrl}}/api/v1/users/{{userId}}"',
        },
        {
            label: "headers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "headers:\n\t",
            detail: 'HTTP headers [object of key: value]',
            documentation: 'Key-value pairs for HTTP headers to include in the request. Common headers include Authorization, Content-Type, Accept, etc.\nExample:\nheaders:\n  Authorization: "Bearer {{token}}"\n  Content-Type: "application/json"\n  Accept: "application/json"',
        },
        {
            label: "body",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "body: ",
            detail: 'Request body [string or object]',
            documentation: 'The request payload/body content. Can be a string, object, or template with variables. Used primarily with POST, PUT, PATCH methods.\nExample:\nbody:\n  username: "{{username}}"\n  email: "{{email}}"\n  password: "{{password}}"',
        },
        {
            label: "query",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "query:\n\t",
            detail: 'Query parameters [object of key: value]',
            documentation: 'URL query parameters as key-value pairs. These are appended to the URL after the ? symbol.\nExample:\nquery:\n  page: "1"\n  limit: "10"',
        },
        {
            label: "cookies",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cookies:\n\t",
            detail: 'HTTP cookies [object of key: value]',
            documentation: 'Cookies to include in the request as key-value pairs. These are sent in the Cookie header.\nExample:\ncookies:\n  sessionId: "{{sessionId}}"',
        },
        {
            label: "examples",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "examples:\n\t- name: example1\n\t\tdescription: desc\n\t\tinputs:\n\t\t\tkey1: value1\n\t\t\tkey2: value2\n\t\toutputs:\n\t\t\tstatusCode_: 200\n\t\t\tkey1: value1\n",
            detail: 'Usage examples [array of key: value]',
            documentation: 'Provide concrete examples of how to use the API with specific input values. These examples can be used for testing and documentation.\nExample:\nexamples:\n\t- name: "Get Admin User"\n\t\tinputs:\n\t\tuserId: "admin123"\n\t\tapiKey: "test-key-456 "\n\t\toutputs:\n\t\tstatus_code: 200\n\t\tuserName: "Admin User"',
        }
    ];
    const envSuggestions = [
        {
            label: "variables",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "variables:\n\t",
            detail: 'Environment variables [object of key: value]',
            documentation: 'Define variables that can be used throughout the API definition. These are placeholders that can be replaced with actual values at runtime.\nExample:\nvariables:\n\turl: \n\t\tdevelopment: "https://api.example.com"\n\t\tproduction: "http://localhost:3000"',
        },
        {
            label: "presets",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "presets:\n\t",
            detail: 'API presets [object of key: value]',
            documentation: 'Presets for commonly used environment variable values. Helps with reusability and consistency.\nExample:\npresets:\n\t- name: "production"\n\t  value: "prod"\n\t- name: "staging"\n\t  value: "staging"\n\t- name: "development"\n\t  value: "dev"',
        },
        {
            label: "certificates",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "certificates:\n\t",
            detail: 'Certificate settings [object]',
            documentation: 'Configure SSL/TLS certificates for secure API connections.\nExample:\ncertificates:\n\tca:\n\t\tpaths:\n\t\t\t- ./certs/ca.pem\n\tclients:\n\t\t- name: api-cert\n\t\t\thost: "*.api.example.com"\n\t\t\tcert_path: ./certs/client.pem\n\t\t\tkey_path: ./certs/client.key',
        },
    ];
    const envCertificatesSuggestions = [
        {
            label: "ca",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "ca:\n\t\tpaths:\n\t\t\t- ",
            detail: 'CA certificates [object]',
            documentation: 'Configure custom Certificate Authority certificates.\nExample:\nca:\n\tpaths:\n\t\t- ./certs/ca.pem\n\t\t- ./certs/intermediate.pem',
        },
        {
            label: "clients",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "clients:\n\t\t- name: \n\t\t\thost: \"*\"\n\t\t\tcert_path: \n\t\t\tkey_path: ",
            detail: 'Client certificates [array]',
            documentation: 'Configure client certificates for mutual TLS.\nExample:\nclients:\n\t- name: api-cert\n\t\thost: "*.api.example.com"\n\t\tcert_path: ./certs/client.pem\n\t\tkey_path: ./certs/client.key',
        },
    ];
    const envCaClientSuggestions = [
        {
            label: "name",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "name: ",
            detail: 'Certificate name [string]',
            documentation: 'A descriptive name for this client certificate.',
        },
        {
            label: "host",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "host: ",
            detail: 'Host pattern [string]',
            documentation: 'Host pattern to match for this certificate. Use * for wildcard.\nExample: *.api.example.com',
        },
        {
            label: "cert_path",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cert_path: ",
            detail: 'Certificate path [string]',
            documentation: 'Path to the client certificate file (PEM format).',
        },
        {
            label: "key_path",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "key_path: ",
            detail: 'Key path [string]',
            documentation: 'Path to the private key file (PEM format).',
        },
        {
            label: "passphrase_plain",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "passphrase_plain: ",
            detail: 'Passphrase (plain text) [string]',
            documentation: 'Plain text passphrase for encrypted private key. Avoid committing to version control.',
        },
        {
            label: "passphrase_env",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "passphrase_env: ",
            detail: 'Passphrase env var [string]',
            documentation: 'Name of environment variable containing the passphrase.\nExample: passphrase_env: MY_CERT_PASS',
        },
    ];
    const protocolSuggestion = [
        {
            label: "http",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " http",
            detail: 'HTTP protocol',
            documentation: 'Standard HTTP protocol.',
        },
        {
            label: "https",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " https",
            detail: 'HTTPS protocol (requires tls)',
            documentation: 'HTTPS protocol. For mock servers, requires tls.cert and tls.key configuration.',
        },
        {
            label: "ws",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " ws",
            detail: 'WebSocket protocol',
            documentation: 'WebSocket protocol for bidirectional communication.',
        },
    ]
    const formatSuggestion = [
        {
            label: "json",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " json",
            detail: 'Define a JSON API',
            documentation: 'JSON format for data exchange.',
        },
        {
            label: "xml",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " xml",
            detail: 'Define a XML API',
            documentation: 'XML format for data exchange.',
        },
        {
            label: "text",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " text",
            detail: 'Define a text API',
            documentation: 'Text format for data exchange.',
        },
    ]
    const methodSuggestions = [
        {
            label: "get",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " get",
            detail: 'Define a GET API',
            documentation: 'GET method for retrieving data from the server. Used for read-only operations',
        },
        {
            label: "post",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " post",
            detail: 'Define a POST API',
            documentation: 'POST method for creating new resources on the server. Used for submitting data',
        },
        {
            label: "put",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " put",
            detail: 'Define a PUT API',
            documentation: 'PUT method for updating existing resources on the server. Replaces the entire resource',
        },
        {
            label: "patch",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " patch",
            detail: 'Define a PATCH API',
            documentation: 'PATCH method for partially updating existing resources on the server. Only updates specified fields',
        },
        {
            label: "delete",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " delete",
            detail: 'Define a DELETE API',
            documentation: 'DELETE method for removing resources from the server',
        },
        {
            label: "head",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " head",
            detail: 'Define a HEAD API',
            documentation: 'HEAD method for retrieving headers without the response body. Used to check resource existence or metadata',
        },
        {
            label: "options",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " options",
            detail: 'Define an OPTIONS API',
            documentation: 'OPTIONS method for retrieving allowed methods and other options for a resource. Used for CORS preflight requests',
        },
        {
            label: "trace",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " trace",
            detail: 'Define a TRACE API',
            documentation: 'TRACE method for diagnostic purposes. Returns the request as received by the server',
        }
    ];
    const outputsSuggestions = [
        {
            label: "statusCode_",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "statusCode_: ",
            detail: 'HTTP status code (number)',
            documentation: 'Built-in output containing the HTTP status code returned by the API call (e.g. 200, 404, 500).\nExample: statusCode_: 200',
            sortText: '0statusCode_',
        },
        {
            label: "regex ",
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: " regex ",
            detail: 'regex expression to extract data from response body [regex]',
            documentation: 'Extracts data from the response body using a regular expression. The regex should match the desired content and can include capture groups to extract specific values.\nExample: regex <data>(.*)</data>',
        },
        {
            label: "body.",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " body.",
            detail: 'Extract data from response body [JSONPath]',
            documentation: 'Extracts data from the response body using JSONPath expressions. This allows you to navigate the JSON structure and extract specific fields.\nExample: body.data[0].user.id. This also works for XML contents.',
        },
        {
            label: "headers.",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " headers.",
            detail: 'Extract data from response headers [JSONPath]',
            documentation: 'Extracts data from the response headers using header name.',
        }
    ];

    const checkAssertObjectKeySuggestions = [
        {
            label: 'actual',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'actual: ',
            detail: 'Actual value [expr]',
            documentation: 'Expression/value to compare.'
        },
        {
            label: 'expected',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'expected: ',
            detail: 'Expected value [expr]',
            documentation: 'Expected value for comparison.'
        },
        {
            label: 'operator',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'operator: "=="',
            detail: 'Comparison operator [string]',
            documentation: 'Operator used to compare actual and expected.'
        },
        {
            label: 'title',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'title: ',
            detail: 'Short title [string]',
            documentation: 'Short summary shown inline in reports/UI.'
        },
        {
            label: 'details',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'details: ',
            detail: 'Details [string]',
            documentation: 'Long description shown in the details panel.'
        },
        {
            label: 'report',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'report: ',
            detail: 'Report level [string | object]',
            documentation: [
                'Controls when check/assert results are reported.',
                '',
                'Values: all, fails, none',
                '  - all: report both passes and failures',
                '  - fails: report only failures (default for external)',
                '  - none: silent, no reporting',
                '',
                'Shorthand: report: all',
                '',
                'Object form (different levels for direct vs imported/suite):',
                '  report:',
                '    internal: all   # when running directly',
                '    external: fails # when imported or in a suite'
            ].join('\n')
        },
    ];

    const operatorValueSuggestions = [
        { label: '==', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "=="', detail: 'Equal', documentation: 'Checks equality.' },
        { label: '!=', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "!="', detail: 'Not equal', documentation: 'Checks inequality.' },
        { label: '>', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' ">"', detail: 'Greater than', documentation: 'Checks actual > expected.' },
        { label: '>=', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' ">="', detail: 'Greater than or equal', documentation: 'Checks actual >= expected.' },
        { label: '<', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "<"', detail: 'Less than', documentation: 'Checks actual < expected.' },
        { label: '<=', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "<="', detail: 'Less than or equal', documentation: 'Checks actual <= expected.' },
        { label: '=@', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "=@"', detail: 'Contains', documentation: 'Checks actual contains expected.' },
        { label: '!@', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "!@"', detail: 'Not contains', documentation: 'Checks actual does not contain expected.' },
        { label: '=~', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "=~"', detail: 'Regex match', documentation: 'Checks actual matches regex expected.' },
        { label: '!~', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "!~"', detail: 'Regex not match', documentation: 'Checks actual does not match regex expected.' },
        { label: '=^', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "=^"', detail: 'Starts with', documentation: 'Checks actual starts with expected.' },
        { label: '!^', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "!^"', detail: 'Not starts with', documentation: 'Checks actual does not start with expected.' },
        { label: '=$', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "=$"', detail: 'Ends with', documentation: 'Checks actual ends with expected.' },
        { label: '!$', kind: monaco.languages.CompletionItemKind.EnumMember, insertText: ' "!$"', detail: 'Not ends with', documentation: 'Checks actual does not end with expected.' },
    ];
    const exampleSuggestions = [
        {
            label: "name",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "name: ",
            detail: 'Example name [string]',
            documentation: 'A unique identifier for this example. Used to distinguish between different test scenarios or use cases.\nExample: name: "Create Admin User"',
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'Example description [string]',
            documentation: 'A detailed description of what this example demonstrates, its purpose, and expected behavior.\nExample: description: "This example shows how to create a new admin user with full permissions"',
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n\t",
            detail: 'Input parameters [array of objects]',
            documentation: 'Define specific input values for this example. These override the default inputs defined at the API level and provide concrete test data.\nExample:\ninputs:\n\t- username: "admin123"\n\t- email: "admin@example.com"\n\t- role: "administrator"\n\t- password: "SecurePass123!"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n\t",
            detail: 'Expected outputs [object]',
            documentation: 'Define expected output values for this example. Used to verify the API response matches expectations.\nExample:\noutputs:\n\tstatusCode_: 200\n\tbody: {"id": 1}',
        }
    ];
    const servicesSuggestions = [
        { label: 'name', kind: monaco.languages.CompletionItemKind.Property, insertText: 'name: ', detail: 'Service name', documentation: 'Section title for a group of APIs.' },
        { label: 'description', kind: monaco.languages.CompletionItemKind.Property, insertText: 'description: ', detail: 'Service description', documentation: 'Shown under the section title.' },
        { label: 'sources', kind: monaco.languages.CompletionItemKind.Property, insertText: 'sources:\n\t- ', detail: 'Service sources', documentation: 'Folders or .mmt files for this group.' },
    ];
    const htmlSuggestions = [
        {
            label: 'triable',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'triable: true',
            detail: 'Enable Try It button [boolean]',
            documentation: 'When true, adds a "Try" button to each endpoint in the HTML doc. Clicking it opens an interactive panel to send requests and view responses (like Swagger Try It Out).'
        },
        {
            label: 'cors_proxy',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'cors_proxy: ',
            detail: 'CORS proxy URL [string]',
            documentation: 'Optional CORS proxy prefix for Try It requests. Prepended to the API URL when the browser blocks cross-origin requests.\nExample: cors_proxy: https://corsproxy.io/?'
        }
    ];

    // Mock server suggestions
    const mockSuggestions = [
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'Mock server title [string]',
            documentation: 'A descriptive title for this mock server.'
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'Mock server description [string]',
            documentation: 'Optional description of the mock server.'
        },
        {
            label: "tags",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tags:\n\t- ",
            detail: 'Mock server tags [array of strings]',
            documentation: 'Tags for categorizing mock servers.'
        },
        {
            label: "protocol",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "protocol: ",
            detail: 'Server protocol [http, https, ws]',
            documentation: 'Server protocol. Defaults to http.\nOptions:\n\t- http: Plain HTTP server\n\t- https: HTTPS server (requires tls config)\n\t- ws: WebSocket server'
        },
        {
            label: "port",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "port: ",
            detail: 'Listen port [number, 1-65535]',
            documentation: 'Port number the mock server will listen on.\nExample: port: 3000'
        },
        {
            label: "tls",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tls:\n\tcert: \n\tkey: ",
            detail: 'TLS configuration [object]',
            documentation: 'TLS certificate configuration for HTTPS. Requires cert and key paths.\nExample:\ntls:\n  cert: ./certs/server.crt\n  key: ./certs/server.key'
        },
        {
            label: "cors",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cors: true",
            detail: 'Enable CORS [boolean]',
            documentation: 'When true, adds Access-Control-Allow-Origin: * and related CORS headers to all responses.'
        },
        {
            label: "delay",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "delay: ",
            detail: 'Global response delay [number, ms]',
            documentation: 'Global response delay in milliseconds applied to all endpoints. Can be overridden per endpoint.\nExample: delay: 200'
        },
        {
            label: "headers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "headers:\n\t",
            detail: 'Global response headers [object]',
            documentation: 'Default response headers applied to all endpoints. Per-endpoint headers are merged on top.\nExample:\nheaders:\n  X-Powered-By: multimeter-mock'
        },
        {
            label: "endpoints",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "endpoints:\n\t- path: /\n\t  status: 200\n\t  body: ",
            detail: 'Endpoint definitions [array]',
            documentation: 'Array of endpoint definitions. First matching endpoint wins.\nEach endpoint defines a path, optional method/match, and a response (status, headers, body).\nExample:\nendpoints:\n  - path: /users\n    method: get\n    status: 200\n    format: json\n    body:\n      users: []'
        },
        {
            label: "proxy",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "proxy: ",
            detail: 'Proxy URL for unmatched requests [string]',
            documentation: 'Forward unmatched requests to this URL. Useful for partial mocking.\nExample: proxy: https://api.example.com'
        },
        {
            label: "fallback",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "fallback:\n\tstatus: 404\n\tbody: ",
            detail: 'Default response for unmatched routes [object]',
            documentation: 'Response returned when no endpoint matches and no proxy is configured.\nExample:\nfallback:\n  status: 404\n  format: json\n  body:\n    error: "Not found"'
        },
    ];
    const mockEndpointSuggestions = [
        {
            label: "method",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "method: ",
            detail: 'HTTP method [string]',
            documentation: 'HTTP method to match. If omitted, matches any method.\nOptions: get, post, put, delete, patch, head, options'
        },
        {
            label: "path",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "path: ",
            detail: 'URL path pattern [string]',
            documentation: 'URL path to match. Supports Express-style parameters.\nExamples:\n  path: /users\n  path: /users/:id\n  path: /files/:folder/:name'
        },
        {
            label: "name",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "name: ",
            detail: 'Endpoint name [string]',
            documentation: 'Optional name for this endpoint. Callers can select it via the x-mock-example header.\nExample: name: admin-user'
        },
        {
            label: "match",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "match:\n\t",
            detail: 'Conditional matching [object]',
            documentation: 'Additional match criteria beyond method+path. Supports partial body, headers, and query matching.\nExample:\nmatch:\n  headers:\n    Authorization: Bearer admin-token\n  query:\n    page: "1"'
        },
        {
            label: "status",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "status: ",
            detail: 'HTTP status code [number, 100-599]',
            documentation: 'Response status code. Defaults to 200.\nExample: status: 201'
        },
        {
            label: "format",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "format: ",
            detail: 'Response format [json, xml, text]',
            documentation: 'Response body format. Auto-detected from body if not specified.'
        },
        {
            label: "headers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "headers:\n\t",
            detail: 'Response headers [object]',
            documentation: 'Response headers for this endpoint. Merged with global headers.\nExample:\nheaders:\n  Cache-Control: no-cache'
        },
        {
            label: "body",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "body: ",
            detail: 'Response body [any]',
            documentation: 'Response body content. Supports JSON objects, strings, or any YAML value.\nTokens like <<r:uuid>>, <<c:timestamp>>, <<e:VAR>> are resolved at runtime.\nPath parameters like :id are substituted from the request URL.'
        },
        {
            label: "delay",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "delay: ",
            detail: 'Response delay [number, ms]',
            documentation: 'Per-endpoint response delay in milliseconds. Overrides the global delay.\nExample: delay: 500'
        },
        {
            label: "reflect",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "reflect: true",
            detail: 'Echo request body [boolean]',
            documentation: 'When true, echoes the request body back as the response body. Useful for testing.'
        },
    ];
    const mockMatchSuggestions = [
        {
            label: "body",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "body:\n\t",
            detail: 'Partial body match [object]',
            documentation: 'Partial JSON match against the request body. All specified keys must match (deep partial).\nExample:\nmatch:\n  body:\n    action: create'
        },
        {
            label: "headers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "headers:\n\t",
            detail: 'Header match [object]',
            documentation: 'Match specific request headers (case-insensitive values).\nExample:\nmatch:\n  headers:\n    Authorization: Bearer admin-token'
        },
        {
            label: "query",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "query:\n\t",
            detail: 'Query parameter match [object]',
            documentation: 'Match specific query string parameters.\nExample:\nmatch:\n  query:\n    page: "1"\n    sort: name'
        },
    ];
    const mockTlsSuggestions = [
        {
            label: "cert",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cert: ",
            detail: 'Certificate path [string]',
            documentation: 'Path to the TLS certificate file (PEM format).\nExample: cert: ./certs/server.crt'
        },
        {
            label: "key",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "key: ",
            detail: 'Private key path [string]',
            documentation: 'Path to the TLS private key file (PEM format).\nExample: key: ./certs/server.key'
        },
        {
            label: "ca",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "ca: ",
            detail: 'CA certificate path [string]',
            documentation: 'Path to CA certificate for client verification.\nExample: ca: ./certs/ca.pem'
        },
        {
            label: "requestCert",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "requestCert: true",
            detail: 'Request client certificate [boolean]',
            documentation: 'When true, the server requests a client certificate for mutual TLS.'
        },
    ];
    const mockFallbackSuggestions = [
        {
            label: "status",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "status: ",
            detail: 'Fallback status code [number]',
            documentation: 'Status code for unmatched routes. Defaults to 404.\nExample: status: 404'
        },
        {
            label: "format",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "format: ",
            detail: 'Fallback format [json, xml, text]',
            documentation: 'Response format for the fallback response.'
        },
        {
            label: "headers",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "headers:\n\t",
            detail: 'Fallback headers [object]',
            documentation: 'Headers returned with the fallback response.'
        },
        {
            label: "body",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "body: ",
            detail: 'Fallback body [any]',
            documentation: 'Body content for the fallback response.\nExample:\nfallback:\n  body:\n    error: "Not found"'
        },
    ];
    // Sibling property suggestions for step list items (shown without leading dash)
    const callSiblings = [
        { label: 'id', kind: monaco.languages.CompletionItemKind.Property, insertText: 'id: ', detail: 'Capture call result', documentation: 'Variable name to capture the call output.\nExample:\n- call: login\n  id: loginResult' },
        { label: 'title', kind: monaco.languages.CompletionItemKind.Property, insertText: 'title: ', detail: 'Test box title', documentation: 'Explicit title for the test box shown in results.\nOverrides the default title priority (called file title → import key → filename → id).\nExample:\n- call: login\n  title: Login Verification\n  check: status == 200' },
        { label: 'inputs', kind: monaco.languages.CompletionItemKind.Property, insertText: 'inputs:\n\t', detail: 'Override call inputs', documentation: 'Key-value inputs to pass to the called API/test.\nExample:\n- call: login\n  inputs:\n    username: alice' },
        { label: 'check', kind: monaco.languages.CompletionItemKind.Property, insertText: 'check: ', detail: 'Inline check on output', documentation: 'Check an output parameter of the call.\nSingle:\n- call: login\n  check: status == 200\nMultiple:\n- call: login\n  check:\n    - status == 200\n    - token != null' },
        { label: 'assert', kind: monaco.languages.CompletionItemKind.Property, insertText: 'assert: ', detail: 'Inline assert on output', documentation: 'Assert an output parameter of the call (stops on failure).\nExample:\n- call: login\n  assert: status == 200' },
        { label: 'report', kind: monaco.languages.CompletionItemKind.Property, insertText: 'report: ', detail: 'Report level for inline checks', documentation: 'Controls when inline check/assert results are reported.\nValues: all, fails, none\nOr object form: { internal: all, external: fails }' },
    ];
    const checkAssertSiblings = [
        { label: 'title', kind: monaco.languages.CompletionItemKind.Property, insertText: 'title: ', detail: 'Check title', documentation: 'Short summary shown inline in reports/UI.' },
        { label: 'details', kind: monaco.languages.CompletionItemKind.Property, insertText: 'details: ', detail: 'Check details', documentation: 'Long description shown in the details panel.' },
        { label: 'report', kind: monaco.languages.CompletionItemKind.Property, insertText: 'report: ', detail: 'Report level', documentation: 'Controls when check/assert results are reported.\nValues: all, fails, none\nOr object form: { internal: all, external: fails }' },
    ];
    const ifSiblings = [
        { label: 'steps', kind: monaco.languages.CompletionItemKind.Property, insertText: 'steps:\n\t', detail: 'Conditional steps', documentation: 'Steps to execute when the condition is true.' },
        { label: 'else', kind: monaco.languages.CompletionItemKind.Property, insertText: 'else:\n\t', detail: 'Else steps', documentation: 'Steps to execute when the condition is false.' },
    ];
    const forRepeatSiblings = [
        { label: 'steps', kind: monaco.languages.CompletionItemKind.Property, insertText: 'steps:\n\t', detail: 'Loop body steps', documentation: 'Steps to execute in each iteration.' },
    ];
    const dataSiblings = [
        { label: 'id', kind: monaco.languages.CompletionItemKind.Property, insertText: 'id: ', detail: 'Data variable name', documentation: 'Variable name to access loaded data in subsequent steps.' },
    ];

    const keySuggestionsByParent: Record<string, any[]> = {
        root: rootSuggestions,
        general: variablesSuggestions,
        api: apiSuggestions,
        test: testSuggestions,
        suite: suiteSuggestions,
        doc: docSuggestions,
        report: reportSuggestions,
        mock: mockSuggestions,
        services: servicesSuggestions,
        html: htmlSuggestions,
        env: envSuggestions,
        certificates: envCertificatesSuggestions,
        clients: envCaClientSuggestions,
        type: typeSuggestions,
        examples: exampleSuggestions,
        steps: stepsSuggestions,
        stages: stageSuggestions,
        protocol: protocolSuggestion,
        method: methodSuggestions,
        format: formatSuggestion,
        outputs: outputsSuggestions,
        check: checkAssertObjectKeySuggestions,
        assert: checkAssertObjectKeySuggestions,
        operator: operatorValueSuggestions,
        endpoints: mockEndpointSuggestions,
        match: mockMatchSuggestions,
        tls: mockTlsSuggestions,
        fallback: mockFallbackSuggestions,
        'step-call': callSiblings,
        'step-check': checkAssertSiblings,
        'step-assert': checkAssertSiblings,
        'step-if': ifSiblings,
        'step-for': forRepeatSiblings,
        'step-repeat': forRepeatSiblings,
        'step-data': dataSiblings,
    };

    return keySuggestionsByParent;
}