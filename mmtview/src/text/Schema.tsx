export const GeneralSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['api', 'env', 'var'] },
    }
}

export const APISchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'protocol', 'format', 'url'],
    properties: {
        type: { type: 'string', enum: ['api'] },
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        description: { type: 'string' },
        import: {
            type: 'object',
            additionalProperties: { type: 'string' }
        },
        inputs: {
            type: 'object',
            additionalProperties: { type: 'string' }
        },
        outputs: {
            type: 'object',
            description: 'Output parameters as key-value pairs',
            additionalProperties: { type: 'string' }
        },
        setenv: {
            type: 'object',
            additionalProperties: { type: 'string' }
        },
        protocol: { type: 'string', enum: ['http', 'ws'] },
        method: {
            type: 'string',
            enum: ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
        },
        format: { type: 'string', enum: ['json', 'xml', 'text'] },
        url: { type: 'string' },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        query: { type: 'object', additionalProperties: { type: 'string' } },
        cookies: { type: 'object', additionalProperties: { type: 'string' } },
        body: {
            anyOf: [
                { type: 'string' },
                { type: 'object', additionalProperties: true }
            ]
        },
        examples: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    inputs: {
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
                additionalProperties: false
            }
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
                    method: { enum: ['post', 'put', 'patch'] }
                }
            },
            then: {
                required: ['body']
            }
        }
    ],
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