export const GeneralSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['api', 'env', 'var'], description: 'Type of mmt file, must be one of: api, env, var' },
    }
}

export const APISchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['api'], description: 'To define an API schema' },
        title: { type: 'string', description: 'The title of the API' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the API, helps with organization and searchability' },
        description: { type: 'string' },
        import: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } },
        inputs: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: {
                    anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        { type: 'boolean' },
                        { type: 'null' }
                    ]
                }
            }
        },
        outputs: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: {
                    anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        { type: 'boolean' },
                        { type: 'null' }
                    ]
                }
            }
        },
        setenv: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: {
                    anyOf: [
                        { type: 'string' }
                    ]
                }
            }
        },
        interfaces: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'protocol', 'format', 'url'],
                properties: {
                    name: { type: 'string' },
                    protocol: { type: 'string', enum: ['http', 'ws'] },
                    method: {
                        type: 'string',
                        enum: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
                    },
                    format: { type: 'string', enum: ['json', 'xml', 'text'] },
                    url: { type: 'string', format: 'uri' },
                    headers: { type: 'object', additionalProperties: { type: 'string' } },
                    query: { type: 'object', additionalProperties: { type: 'string' } },
                    cookies: { type: 'object', additionalProperties: { type: 'string' } },
                    body: {
                        anyOf: [
                            { type: 'string' },
                            { type: 'object', additionalProperties: true }
                        ]
                    },
                    outputs: {
                        type: 'object',
                        additionalProperties: true
                    }
                },
                allOf: [
                    {
                        if: {
                            properties: {
                                protocol: { const: 'http' }
                            }
                        },
                        then: {
                            required: ['method']
                        }
                    },
                    {
                        if: {
                            properties: {
                                method: { const: 'post' }
                            }
                        },
                        then: {
                            required: ['body']
                        }
                    },
                    {
                        if: {
                            properties: {
                                method: { const: 'put' }
                            }
                        },
                        then: {
                            required: ['body']
                        }
                    },
                    {
                        if: {
                            properties: {
                                method: { const: 'patch' }
                            }
                        },
                        then: {
                            required: ['body']
                        }
                    }
                ],
                additionalProperties: false
            }
        },
        examples: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    inputs: {
                        type: 'array', items: {
                            type: 'object',
                            additionalProperties: {
                                anyOf: [
                                    { type: 'string' },
                                    { type: 'number' },
                                    { type: 'boolean' },
                                    { type: 'null' }
                                ]
                            }
                        }
                    }
                },
                additionalProperties: false
            }
        }
    },
    additionalProperties: false
};

export const EnvSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['env'], description: 'To define an environment schema' },
        variables: {
            type: 'object',
            description: 'Environment variables definition',
            additionalProperties: {
                anyOf: [
                    { type: 'string' },
                    { type: 'object', additionalProperties: true },
                    {
                        type: 'array',
                        items: {
                            anyOf: [
                                { type: 'string' },
                                { type: 'number' },
                                { type: 'boolean' },
                                { type: 'null' }
                            ]
                        }
                    }
                ]
            },
        },
        presets: {
            type: 'object',
            description: 'Environment presets configuration',
            additionalProperties: {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    description: 'Environment configuration referencing variables section keys',
                    additionalProperties: {
                        anyOf: [
                            { type: 'string' },
                            { type: 'number' },
                            { type: 'boolean' },
                            { type: 'null' }
                        ]
                    }
                }
            }
        }
    },
    additionalProperties: false
};