import { APISchema } from './Schema';
import Ajv from 'ajv';
import { js2xml, xml2js } from 'xml-js';
import YAML from 'yaml';

// Add validation functions
const ajv = new Ajv({ allErrors: true, verbose: true });

const validateYamlContent = (content: string): any[] => {
    const errors: any[] = [];

    try {
        // Parse YAML to JavaScript object using YAML library
        const parsedContent = YAML.parse(content);

        if (!parsedContent) {
            return errors;
        }

        // Validate against schema
        const validate = ajv.compile(APISchema);
        const isValid = validate(parsedContent);

        if (!isValid && validate.errors) {
            validate.errors.forEach(error => {
                if (
                    error.keyword === "additionalProperties" &&
                    typeof (error.params as any).additionalProperty === "string"
                ) {
                    const { line, column } = findFirstOccurrence(content, (error.params as any).additionalProperty);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `Invalid property "${(error.params as any).additionalProperty}"`,
                        source: 'mmt-validation'
                    });
                }
                else {
                    const path = (error as any).instancePath || (error as any).dataPath || '';
                    const line = getLineNumberFromPath(content, path);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: 1,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `${path}: ${error.message}`,
                        source: 'mmt-validation'
                    });
                }
            });
        }

        return errors;
    } catch (yamlError: any) {
        // YAML parsing error from YAML library
        const line = yamlError.linePos?.[0]?.line || yamlError.source?.start?.line || 1;
        const column = yamlError.linePos?.[0]?.col || yamlError.source?.start?.col || 1;

        errors.push({
            severity: 8,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 10,
            message: `YAML Parse Error: ${yamlError.message}`,
            source: 'yaml-syntax'
        });

        return errors;
    }
};

const getLineNumberFromPath = (content: string, path: string): number => {
    console.log('getLineNumberFromPath', { content, path });
    const lines = content.split('\n');
    const pathParts = path.split('/').filter(part => part !== '');

    if (pathParts.length === 0) return 1;

    let currentLine = 1;
    for (const line of lines) {
        if (line.trim().startsWith(`${pathParts[0]}:`)) {
            return currentLine;
        }
        currentLine++;
    }

    return 1;
};

const findFirstOccurrence = (content: string, searchText: string): { line: number; column: number; found: boolean } => {
    if (!content || !searchText) {
        return { line: 1, column: 1, found: false };
    }

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const columnIndex = line.indexOf(searchText);

        if (columnIndex !== -1) {
            return {
                line: lineIndex + 1, // 1-based line number
                column: columnIndex + 1, // 1-based column number
                found: true
            };
        }
    }

    return { line: 1, column: 1, found: false };
};

export const handleBeforeMount = (monaco: any) => {
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
            insertText: "import:\n\t- ",
            detail: 'Import external parameters [array of key: value]',
            documentation: 'Import parameters from external sources or other API definitions. Allows reusing common parameters across multiple APIs.\nExample:\nimport:\n\t- baseUrl: "{{env.API_BASE_URL}}"\n\t- authToken: "{{env.AUTH_TOKEN}}"',
        },
        {
            label: "inputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "inputs:\n\t- ",
            detail: 'Input parameters [array of key: value]',
            documentation: 'Define input parameters that can be used throughout the API definition. These are variables that can be referenced in URLs, headers, and body.\nExample:\ninputs:\n\t- userId: "123"\n\t- apiKey: "{{env.API_KEY}}"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n\t- ",
            detail: 'Output parameters [array of key: value]',
            documentation: 'Define how to extract values from API responses. These extracted values can be used in subsequent requests or stored as environment variables.\nExample:\noutputs:\n\t- userId: "$.data.user.id"\n\t- token: "$.data.access_token"',
        },
        {
            label: "setenv",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "setenv:\n\t- ",
            detail: 'Set environment variables [array of key: value]',
            documentation: 'Map output values to environment variables that can be used in other APIs. Links extracted outputs to environment variable names.\nExample:\nsetenv:\n\t- USER_ID: "userId"\n\t- ACCESS_TOKEN: "token"',
        },
        {
            label: "interfaces",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "interfaces:\n\t- name: interface1\n\t\tprotocol: http\n\t\tmethod: post\n\t\tformat: json\n\t\turl: localhost:8080\n\t\theaders:\n\t\t\t- agent: multimeter\n\t\tbody:\n\t\t\tsample: json\n",
            detail: 'API interfaces [array of key: value]',
            documentation: 'Define the actual API endpoints and their configurations. Each interface represents a specific API call with its method, URL, headers, body, and expected outputs.\nExample:\ninterfaces:\n\t- name: "get_user"\n    protocol: http\n    method: get\n    format: json\n    url: "{{baseUrl}}/users/{{userId}}"\n    headers:\n      Authorization: "Bearer {{token}}"\n    body: {}\n    outputs:\n      username: "$.data.username"',
        },
        {
            label: "examples",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "examples:\n\t- name: example1\n\t\tinputs: \n\t\t\t- key1: value1\n\t\t\t- key2: value2\n",
            detail: 'Usage examples [array of key: value]',
            documentation: 'Provide concrete examples of how to use the API with specific input values. These examples can be used for testing and documentation.\nExample:\nexamples:\n\t- name: "Get Admin User"\n    inputs:\n      - userId: "admin123"\n      - apiKey: "test-key-456"',
        }
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
    ]
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
            insertText: "headers:\n\t- ",
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
            insertText: "query:\n\t- ",
            detail: 'Query parameters [array of key: value]',
            documentation: 'URL query parameters as key-value pairs. These are appended to the URL after the ? symbol.\nExample:\nquery:\n  page: "{{page}}"\n  limit: "10"\n  sort: "name"\n  filter: "active"',
        },
        {
            label: "cookies",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "cookies:\n\t- ",
            detail: 'HTTP cookies [array of key: value]',
            documentation: 'Cookies to include in the request as key-value pairs. These are sent in the Cookie header.\nExample:\ncookies:\n  sessionId: "{{sessionId}}"\n  userId: "{{userId}}"\n  preferences: "dark-mode"',
        },
        {
            label: "outputs",
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: "outputs:\n\t- ",
            detail: 'Response data extraction [array of key: value]',
            documentation: 'Define how to extract specific values from the API response. Uses JSONPath expressions to extract data that can be used in other requests or stored as variables.\nExample:\noutputs:\n  userId: "body.data.user.id"\n  token: "header.access_token"\n  userName: "regex <`data>(.*)</data>"',
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
        api: apiSuggestions,
        type: typeSuggestions,
        interfaces: interfaceSuggestions,
        examples: exampleSuggestions,
        protocol: protocolSuggestion,
        method: methodSuggestions,
        format: formatSuggestion,
        outputs: outputsSuggestions,
    };

    monaco.languages.registerCompletionItemProvider("yaml", {
        provideCompletionItems: (model: any, position: any) => {
            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lines = model.getLinesContent().slice(0, lineNumber - 1);

            // Check if current line is like: key: <cursor> (maybe with spaces)
            const keyValueMatch = lineContent.match(/^(\s*)(\w+):\s*(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[2];
                const colonPosition = lineContent.indexOf(':');
                const valueStartColumn = colonPosition + 2;

                if (position.column >= valueStartColumn) {
                    // Use the key as parent context
                    if (key in keySuggestionsByParent) {
                        return {
                            suggestions: keySuggestionsByParent[key].map(item => ({
                                ...item,
                                documentation: `${item.documentation}`,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: valueStartColumn,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                }
                            }))
                        };
                    }

                    return { suggestions: [] };
                }
            }

            // Check if we're in a list item context (after "- key: ")
            const listItemMatch = lineContent.match(/^(\s*)-\s+(\w+):\s*(.*)$/);
            if (listItemMatch) {
                const indentation = listItemMatch[1];
                const key = listItemMatch[2];
                const colonPosition = lineContent.lastIndexOf(':');
                const valueStartColumn = colonPosition + 2;

                if (position.column >= valueStartColumn) {
                    // For list items, use the key as context
                    if (key in keySuggestionsByParent) {
                        return {
                            suggestions: keySuggestionsByParent[key].map(item => ({
                                ...item,
                                documentation: `${item.documentation}`,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: valueStartColumn,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                }
                            }))
                        };
                    }

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i];
                        if (!line.trim()) continue;

                        const indent = line.search(/\S|$/);
                        if (indent < indentation.length) {
                            const match = line.trim().match(/^(\w+):/);
                            if (match && match[1] === "outputs") {
                                return {
                                    suggestions: outputsSuggestions.map(item => ({
                                        ...item,
                                        range: {
                                            startLineNumber: position.lineNumber,
                                            startColumn: valueStartColumn,
                                            endLineNumber: position.lineNumber,
                                            endColumn: lineContent.length + 1
                                        }
                                    }))
                                };
                            }
                            break;
                        }
                    }

                    return { suggestions: [] };
                }
            }

            let parent = "root";
            const currentIndent = lineContent.search(/\S|$/);

            if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: api")) {
                parent = "api";
            } else if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: env")) {
                parent = "env";
            } else if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: var")) {
                parent = "var";
            } else {
                // Look for parent context by indentation
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    const indent = line.search(/\S|$/);
                    if (indent < currentIndent) {
                        const match = line.trim().match(/^\s*(\w+):/);
                        if (match) {
                            parent = match[1];
                            break;
                        }

                        if (line.trim().startsWith("- ")) {
                            for (let j = i - 1; j >= 0; j--) {
                                const upperLine = lines[j];
                                if (!upperLine.trim()) continue;
                                const upperMatch = upperLine.trim().match(/^\s*(\w+):/);
                                if (upperMatch) {
                                    parent = upperMatch[1];
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            const baseSuggestions = keySuggestionsByParent[parent] || [];

            const suggestions = baseSuggestions.map(item => ({
                ...item,
                documentation: item.documentation,
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: model.getLineFirstNonWhitespaceColumn(position.lineNumber) || position.lineNumber,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                }
            }));

            return { suggestions };
        },
        triggerCharacters: ["\n", " ", ":", "-"],
    });

    // Add validation provider
    let validationTimeout: NodeJS.Timeout;

    const validateModel = (model: any) => {
        clearTimeout(validationTimeout);

        // Debounce validation by 500ms
        validationTimeout = setTimeout(() => {
            const content = model.getValue();
            const markers = validateYamlContent(content);

            // Set markers on the model
            monaco.editor.setModelMarkers(model, 'mmt-validation', markers);
        }, 500);
    };

    // Register model change listener for validation
    monaco.editor.onDidCreateModel((model: any) => {
        // Validate when model is created
        validateModel(model);

        // Validate when content changes
        model.onDidChangeContent(() => {
            validateModel(model);
        });
    });

    // Also validate existing models
    const models = monaco.editor.getModels();
    models.forEach((model: any) => {
        validateModel(model);

        // Add listener if not already added
        model.onDidChangeContent(() => {
            validateModel(model);
        });
    });
};