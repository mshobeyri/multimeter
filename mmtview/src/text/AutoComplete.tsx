import { loadEnvVariables } from '../workspaceStorage';
import { JSONValue } from 'mmt-core/CommonData';

export const KeySuggestionsByParent = (monaco: any) => {
    const envVariablesSuggestions: any[] = [];

    loadEnvVariables((variables: { name: string; label: string; value: JSONValue }[]) => {
        envVariablesSuggestions.push(...variables.map(envVar => ({
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
            detail: 'Type of mmt file [api, env, var]',
            documentation: 'Type of mmt file, must be one of: api, env, var\n\t- api: Define an API\n\t- env: Define environment variables\n\t- var: Define variables\nExample: type: api',
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
            label: "Variable",
            kind: monaco.languages.CompletionItemKind.EnumMember,
            insertText: " var",
            detail: 'Define variables',
            documentation: 'Variables that can be used within API definitions. These are typically used for dynamic values that change based on context or environment',
        }
    ]
    const apiSuggestions = [
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
            insertText: "tags:\n\t- ",
            detail: 'API tags [array of strings]',
            documentation: 'Tags for categorizing and organizing APIs. Helps with searchability and filtering.\nExample:\ntags:\n\t- user\n\t- authentication\n\t- v1',
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
            documentation: 'Define output parameters that can be used throughout the API definition. These are variables that can be extracted from headers, and body.',
        },
        {
            label: "extract",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "extract:\n\t",
            detail: 'Output parameters [object of key: value]',
            documentation: 'Define how to extract values from API responses. These extracted values can be used in subsequent requests or stored as environment variables.\nExample:\extract:\n\tuserId: "$.data.user.id"\n\ttoken: "$.data.access_token"',
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
            label: "setenv",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "setenv:\n\t",
            detail: 'Set environment variables [object of key: value]',
            documentation: 'Map output values to environment variables that can be used in other APIs. Links extracted outputs to environment variable names.\nExample:\nsetenv:\n\tUSER_ID: "userId"\n\tACCESS_TOKEN: "token"',
        },
        {
            label: "examples",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "examples:\n\t- name: example1\n\t\tinputs: \n\t\t\tkey1: value1\n\t\t\tkey2: value2\n",
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

    const keySuggestionsByParent: Record<string, any[]> = {
        root: rootSuggestions,
        general: envVariablesSuggestions,
        api: apiSuggestions,
        env: envSuggestions,
        type: typeSuggestions,
        examples: exampleSuggestions,
        protocol: protocolSuggestion,
        method: methodSuggestions,
        format: formatSuggestion,
        outputs: outputsSuggestions
    };

    return keySuggestionsByParent;
}