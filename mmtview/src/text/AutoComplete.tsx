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
            detail: 'Type of mmt file [api, env, doc, test]',
            documentation: 'Type of mmt file, must be one of: api, env, doc, test\n\t- api: Define an API\n\t- env: Define environment variables\n\t- doc: Define a documentation page (title/description/sources/theme)\n\t- test: Define a test suite (steps/stages)\nExample: type: test',
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
            documentation: 'Test definition using steps or stages. Supports steps like call, data, check, assert, if/for/repeat, delay, js, print, set, var, const, let.',
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
            documentation: 'Import parameters or data paths used in tests.'
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
            insertText: "steps:\n\t- call: ",
            detail: 'Linear steps [array]',
            documentation: 'Define a sequence of steps (call, data, check, assert, if, for, repeat, delay, js, print, set, var, const, let).'
        },
        {
            label: "stages",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "stages:\n\t- id: stage1\n\t  steps:\n\t  \t- call: ",
            detail: 'Stage-based steps [array]',
            documentation: 'Define named stages with their own steps and optional dependencies.'
        },
    ];
    const stepsSuggestions = [
        { label: "call", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- call: ", detail: 'Call an API by name', documentation: 'Executes an API; supports id and inputs.' },
        { label: "data", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- data: ", detail: 'Load data resource', documentation: 'Load CSV/JSON or other data resource alias.' },
        { label: "check", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- check: ", detail: 'Check expression', documentation: 'Boolean expression to check.' },
        { label: "assert", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- assert: ", detail: 'Assert expression', documentation: 'Boolean assertion that must pass.' },
        { label: "if", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- if: \n  \tsteps:\n  \t- ", detail: 'Conditional block', documentation: 'Conditional steps; add nested steps under steps:' },
        { label: "for", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- for: \n  \tsteps:\n  \t- ", detail: 'Loop over collection', documentation: 'Iterate and execute nested steps.' },
        { label: "repeat", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- repeat: 1\n  \tsteps:\n  \t- ", detail: 'Repeat steps N times', documentation: 'Repeat nested steps.' },
        { label: "delay", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- delay: 1000", detail: 'Delay in ms', documentation: 'Sleep/pause execution for ms.' },
        { label: "js", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- js: ", detail: 'Run JavaScript', documentation: 'Execute JavaScript code.' },
        { label: "print", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- print: ", detail: 'Print message', documentation: 'Log output for debugging.' },
        { label: "set", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- set:\n\t", detail: 'Set variables', documentation: 'Assign variables from expressions.' },
        { label: "var", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- var:\n\t", detail: 'Define variables', documentation: 'Create variables to be used later.' },
        { label: "const", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- const:\n\t", detail: 'Define constants', documentation: 'Immutable values for test context.' },
        { label: "let", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- let:\n\t", detail: 'Define lexical variables', documentation: 'Mutable values for test context.' },
        { label: "id", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- id: ", detail: 'Optional step identifier', documentation: 'Identifier for referencing this step.' },
        { label: "inputs", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- inputs:\n\t", detail: 'Inputs for step', documentation: 'Key-value inputs for this step.' },
        { label: "steps", kind: monaco.languages.CompletionItemKind.Property, insertText: "\t- steps:\n\t\t- ", detail: 'Nested steps', documentation: 'Add nested steps for control-flow steps.' },
    ];
    const stageSuggestions = [
        { label: "id", kind: monaco.languages.CompletionItemKind.Property, insertText: "id: ", detail: 'Stage identifier', documentation: 'Id to reference this stage.' },
        { label: "title", kind: monaco.languages.CompletionItemKind.Property, insertText: "title: ", detail: 'Stage title', documentation: 'Descriptive title for the stage.' },
        { label: "condition", kind: monaco.languages.CompletionItemKind.Property, insertText: "condition: ", detail: 'Conditional expression', documentation: 'Only run the stage if condition is truthy.' },
        { label: "depends_on", kind: monaco.languages.CompletionItemKind.Property, insertText: "depends_on: ", detail: 'Stage dependencies', documentation: 'Name or list of stage names this stage depends on.' },
        { label: "steps", kind: monaco.languages.CompletionItemKind.Property, insertText: "steps:\n\t- call: ", detail: 'Stage steps', documentation: 'Steps to execute in this stage.' },
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
            label: "files",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "files:\n\t- ",
            detail: 'Explicit list of .mmt files [array of strings]',
            documentation: 'Add specific API files to include in the documentation.'
        },
        {
            label: "folders",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "folders:\n\t- ",
            detail: 'Folders to scan recursively [array of strings]',
            documentation: 'Add folders to scan for API files.'
        },
        {
            label: "theme",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "theme:\n\tlogo: \n\tcolors:\n\t\tfg: \"#ddd\"\n\t\tbg: \"#1e1e1e\"\n\t\tmuted: \"#aaa\"\n\t\taccent: \"#0e639c\"\n\t\tcard: \"#111\"\n\t\tborder: \"#333\"\n",
            detail: 'Theming (logo and colors) [object]',
            documentation: 'Customize the doc page appearance. Provide a logo URL and override colors: fg, bg, muted, accent, card, border.'
        },
    ];
    const themeSuggestions = [
        {
            label: "logo",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "\tlogo: ",
            detail: 'Logo URL/path [string]',
            documentation: 'Path or URL to a logo image shown next to the title.'
        },
        {
            label: "colors",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "\tcolors:\n\t\tfg: \"#ddd\"\n\t\tbg: \"#1e1e1e\"\n\t\tmuted: \"#aaa\"\n\t\taccent: \"#0e639c\"\n\t\tcard: \"#111\"\n\t\tborder: \"#333\"\n",
            detail: 'Theme colors [object]',
            documentation: 'Override colors used in the documentation page.'
        },
    ];
    const themeColorsSuggestions = [
        { label: "fg", kind: monaco.languages.CompletionItemKind.Property, insertText: "fg: \"#ddd\"", detail: 'Foreground color', documentation: 'Text color (default #ddd)' },
        { label: "bg", kind: monaco.languages.CompletionItemKind.Property, insertText: "bg: \"#1e1e1e\"", detail: 'Background color', documentation: 'Background color (default #1e1e1e)' },
        { label: "muted", kind: monaco.languages.CompletionItemKind.Property, insertText: "muted: \"#aaa\"", detail: 'Muted text color', documentation: 'Secondary text color (default #aaa)' },
        { label: "accent", kind: monaco.languages.CompletionItemKind.Property, insertText: "accent: \"#0e639c\"", detail: 'Accent color', documentation: 'Links, highlights (default #0e639c)' },
        { label: "card", kind: monaco.languages.CompletionItemKind.Property, insertText: "card: \"#111\"", detail: 'Card background', documentation: 'Panel/card background (default #111)' },
        { label: "border", kind: monaco.languages.CompletionItemKind.Property, insertText: "border: \"#333\"", detail: 'Border color', documentation: 'Borders and separators (default #333)' },
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
            documentation: 'Define how to extract values from API responses as output parameters. These extracted values can be used in subsequent requests or stored as environment variables.\nExample:\extract:\n\tuserId: "$.data.user.id"\n\ttoken: "$.data.access_token"',
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
            detail: 'Communication protocol [http, ws]',
            documentation: 'The protocol used for communication. Supports HTTP for REST APIs and WebSocket for real-time communication.\nOptions:\n\t- http: Standard HTTP/HTTPS requests\n\t- ws: WebSocket connections\nExample: protocol: http',
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
            insertText: "format: json",
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
            insertText: "examples:\n\t- name: example1\n\t  description: desc\n\t  inputs:\n\t\tkey1: value1\n\t\tkey2: value2\n",
            detail: 'Usage examples [array of key: value]',
            documentation: 'Provide concrete examples of how to use the API with specific input values. These examples can be used for testing and documentation.\nExample:\nexamples:\n\t- name: "Get Admin User"\n\tinputs:\n\tuserId: "admin123"\n\tapiKey: "test-key-456"',
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
    ];
    const protocolSuggestion = [
        {
            label: "http",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " http",
            detail: 'Define a HTTP API',
            documentation: 'HTTP method for retrieving data from the server. Used for read-only operations',
        },
        {
            label: "ws",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " ws",
            detail: 'Define a WS API',
            documentation: 'WS method for creating new resources on the server. Used for submitting data',
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
            insertText: "inputs:\n\t- ",
            detail: 'Input parameters [array of objects]',
            documentation: 'Define specific input values for this example. These override the default inputs defined at the API level and provide concrete test data.\nExample:\ninputs:\n\t- username: "admin123"\n\t- email: "admin@example.com"\n\t- role: "administrator"\n\t- password: "SecurePass123!"',
        }
    ];
    const servicesSuggestions = [
        { label: 'name', kind: monaco.languages.CompletionItemKind.Property, insertText: 'name: ', detail: 'Service name', documentation: 'Section title for a group of APIs.' },
        { label: 'description', kind: monaco.languages.CompletionItemKind.Property, insertText: 'description: ', detail: 'Service description', documentation: 'Shown under the section title.' },
        { label: 'sources', kind: monaco.languages.CompletionItemKind.Property, insertText: 'sources:\n\t- ', detail: 'Service sources', documentation: 'Folders or .mmt files for this group.' },
    ];

    const keySuggestionsByParent: Record<string, any[]> = {
        root: rootSuggestions,
        general: variablesSuggestions,
        api: apiSuggestions,
        test: testSuggestions,
        doc: docSuggestions,
        services: servicesSuggestions,
        theme: themeSuggestions,
        colors: themeColorsSuggestions,
        env: envSuggestions,
        type: typeSuggestions,
        examples: exampleSuggestions,
        steps: stepsSuggestions,
        stages: stageSuggestions,
        protocol: protocolSuggestion,
        method: methodSuggestions,
        format: formatSuggestion,
        outputs: outputsSuggestions
    };

    return keySuggestionsByParent;
}