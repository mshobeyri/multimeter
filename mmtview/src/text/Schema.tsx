export const GeneralSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: { type: 'object', enum: ['api', 'env', 'var'] },
}

export const APISchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['api'] },
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
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
                        { type: 'null' } // 'undefined' is not a valid JSON type, use 'null' for missing values
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
        interfaces: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'protocol', 'method', 'format', 'endpoint', 'headers', 'body', 'outputs'],
                properties: {
                    name: { type: 'string' },
                    protocol: { type: 'string', enum: ['http', 'ws'] },
                    method: {
                        type: 'string',
                        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
                    },
                    format: { type: 'string', enum: ['json', 'xml', 'text'] },
                    endpoint: { type: 'string', format: 'uri' },
                    headers: { type: 'object', additionalProperties: { type: 'string' } },
                    body: { type: 'object', additionalProperties: true },
                    outputs: {
                        type: 'object',
                        additionalProperties: true
                    }
                },
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