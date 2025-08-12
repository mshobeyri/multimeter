import { authentication } from "vscode";
import { APISchema } from "./Schema";

export const handleBeforeMount = (monaco: any) => {
    // Dynamically get root keys from APISchema
    const rootSuggestions = [
        {
            label: "type",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "type: api",
            detail: 'Type of mmt file [api, env, var]',
            documentation: 'Type of mmt file, must be one of: api, env, var\n- api: Define an API\n- env: Define an environment\n- var: Define a variable\nExample: type: api',
            preselect: true
        },
        {
            label: "title",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "title: ",
            detail: 'API title [string]',
            documentation: 'A descriptive title for your API. This helps identify and organize your APIs.\nExample: title: User Management API',
        },
        {
            label: "tags",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "tags:\n  - ",
            detail: 'API tags [array of strings]',
            documentation: 'Tags for categorizing and organizing APIs. Helps with searchability and filtering.\nExample:\ntags:\n  - user\n  - authentication\n  - v1',
        },
        {
            label: "description",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "description: ",
            detail: 'API description [string]',
            documentation: 'A detailed description of what this API does, its purpose, and usage notes.\nExample: description: This API handles user authentication and profile management',
        },
        {
            label: "import",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "import:\n  - ",
            detail: 'Import external parameters [array of key: value]',
            documentation: 'Import parameters from external sources or other API definitions. Allows reusing common parameters across multiple APIs.\nExample:\nimport:\n  - baseUrl: "{{env.API_BASE_URL}}"\n  - authToken: "{{env.AUTH_TOKEN}}"',
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n  - ",
            detail: 'Input parameters [array of key: value]',
            documentation: 'Define input parameters that can be used throughout the API definition. These are variables that can be referenced in URLs, headers, and body.\nExample:\ninputs:\n  - userId: "123"\n  - apiKey: "{{env.API_KEY}}"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n  - ",
            detail: 'Output parameters [array of key: value]',
            documentation: 'Define how to extract values from API responses. These extracted values can be used in subsequent requests or stored as environment variables.\nExample:\noutputs:\n  - userId: "$.data.user.id"\n  - token: "$.data.access_token"',
        },
        {
            label: "setenv",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "setenv:\n  - ",
            detail: 'Set environment variables [array of key: value]',
            documentation: 'Map output values to environment variables that can be used in other APIs. Links extracted outputs to environment variable names.\nExample:\nsetenv:\n  - USER_ID: "userId"\n  - ACCESS_TOKEN: "token"',
        },
        {
            label: "interfaces",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "interfaces:\n  - name: interface1\n    protocol: http\n    method: post\n    format: json\n    url: localhost:8080\n    headers:\n        - agent: multimeter\n    body: \n        sample: json\n",
            detail: 'API interfaces [array of key: value]',
            documentation: 'Define the actual API endpoints and their configurations. Each interface represents a specific API call with its method, URL, headers, body, and expected outputs.\nExample:\ninterfaces:\n  - name: "get_user"\n    protocol: http\n    method: get\n    format: json\n    url: "{{baseUrl}}/users/{{userId}}"\n    headers:\n      Authorization: "Bearer {{token}}"\n    body: {}\n    outputs:\n      username: "$.data.username"',
        },
        {
            label: "examples",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "examples:\n  - name: example1\n    inputs: \n      - key1: value1\n      - key2: value2\n",
            detail: 'Usage examples [array of key: value]',
            documentation: 'Provide concrete examples of how to use the API with specific input values. These examples can be used for testing and documentation.\nExample:\nexamples:\n  - name: "Get Admin User"\n    inputs:\n      - userId: "admin123"\n      - apiKey: "test-key-456"',
        }
    ];

    // Interface suggestions for when user is inside an interface block
    const interfaceSuggestions = [
        {
            label: "name",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "name: ",
            detail: 'Interface name [string]',
            documentation: 'A unique identifier for this interface/endpoint. Used to reference this specific API call within the API definition.\nExample: name: "get_user_profile"',
        },
        {
            label: "protocol",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "protocol: http",
            detail: 'Communication protocol [http, ws]',
            documentation: 'The protocol used for communication. Supports HTTP for REST APIs and WebSocket for real-time communication.\nOptions:\n- http: Standard HTTP/HTTPS requests\n- ws: WebSocket connections\nExample: protocol: http',
        },
        {
            label: "method",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "method: get",
            detail: 'HTTP method [get, post, put, patch, delete, head, options, trace]',
            documentation: 'The HTTP method for the request. Defines the type of operation to perform.\nOptions:\n- get: Retrieve data\n- post: Create new resource\n- put: Update entire resource\n- patch: Partial update\n- delete: Remove resource\n- head: Get headers only\n- options: Get allowed methods\n- trace: Debug request path\nExample: method: post',
        },
        {
            label: "format",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "format: json",
            detail: 'Data format [json, xml, text]',
            documentation: 'The format of the request and response data. Determines how the body content is parsed and serialized.\nOptions:\n- json: JavaScript Object Notation\n- xml: Extensible Markup Language\n- text: Plain text format\nExample: format: json',
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
            insertText: "headers:\n  -",
            detail: 'HTTP headers [array of key: value]',
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
            insertText: "query:\n  -",
            detail: 'Query parameters [array of key: value]',
            documentation: 'URL query parameters as key-value pairs. These are appended to the URL after the ? symbol.\nExample:\nquery:\n  page: "{{page}}"\n  limit: "10"\n  sort: "name"\n  filter: "active"',
        },
        {
            label: "cookies",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cookies:\n  -",
            detail: 'HTTP cookies [array of key: value]',
            documentation: 'Cookies to include in the request as key-value pairs. These are sent in the Cookie header.\nExample:\ncookies:\n  sessionId: "{{sessionId}}"\n  userId: "{{userId}}"\n  preferences: "dark-mode"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n  -",
            detail: 'Response data extraction [array of key: value]',
            documentation: 'Define how to extract specific values from the API response. Uses JSONPath expressions to extract data that can be used in other requests or stored as variables.\nExample:\noutputs:\n  userId: "body.data.user.id"\n  token: "header.access_token"\n  userName: "regex <`data>(.*)</data>"',
        }
    ];

    // Example suggestions for when user is inside an example block
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
            insertText: "inputs:\n  - ",
            detail: 'Input parameters [array of objects]',
            documentation: 'Define specific input values for this example. These override the default inputs defined at the API level and provide concrete test data.\nExample:\ninputs:\n  - username: "admin123"\n  - email: "admin@example.com"\n  - role: "administrator"\n  - password: "SecurePass123!"',
        }
    ];

    // Update your keySuggestionsByParent to include examples
    const keySuggestionsByParent: Record<string, any[]> = {
        root: rootSuggestions,
        interfaces: interfaceSuggestions,
        examples: exampleSuggestions,
    };

    monaco.languages.registerCompletionItemProvider("yaml", {
        provideCompletionItems: (model: any, position: any) => {
            const lineNumber = position.lineNumber;
            const lines = model.getLinesContent().slice(0, lineNumber - 1);
            let parent = "root";
            // Find the nearest non-empty, less-indented line above
            const currentIndent = model.getLineContent(lineNumber).search(/\S|$/);
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (!line.trim()) continue;
                const indent = line.search(/\S|$/);
                if (indent < currentIndent) {
                    const match = line.trim().match(/^(\w+):/);
                    if (match) {
                        parent = match[1];
                    }
                    break;
                }
            }
            const suggestions = keySuggestionsByParent[parent] || keySuggestionsByParent.root;
            return { suggestions };
        },

        triggerCharacters: ["\n", " "],
    });
};