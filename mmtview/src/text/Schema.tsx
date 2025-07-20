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
        inputs: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } },
        outputs: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } },
        interfaces: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'protocol', 'method', 'format', 'endpoint', 'headers', 'body', 'outputs'],
                properties: {
                    name: { type: 'string' },
                    protocol: { type: 'string', enum: ['http', 'ws'] },
                    method: { type: 'string' },
                    format: { type: 'string', enum: ['json', 'xml'] },
                    endpoint: { type: 'string', format: 'uri' },
                    headers: { type: 'object', additionalProperties: { type: 'string' } },
                    body: { type: 'object', additionalProperties: true },
                    outputs: {
                        type: 'object',
                        required: ['session', 'errors'],
                        properties: {
                            session: { type: 'object', properties: { json: { type: 'string' } }, additionalProperties: false },
                            errors: { type: 'object', properties: { json: { type: 'string' } }, additionalProperties: false }
                        },
                        additionalProperties: false
                    }
                },
                additionalProperties: false
            }
        },
        examples: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'inputs'],
                properties: {
                    name: { type: 'string' },
                    inputs: { type: 'array', items: { type: 'object', additionalProperties: { type: ['string', 'number'] } } }
                },
                additionalProperties: false
            }
        }
    },
    additionalProperties: false
};