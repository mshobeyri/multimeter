export const GeneralSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
    type: { type: 'string', enum: ['api', 'env', 'var', 'test'] },
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
    // Optional alias of imported CSV data to be available in scripts
    data: { type: 'string' },
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
        },
        outputs: {
            type: 'object',
            additionalProperties: {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'null' }
                ]
            }
        },
        extract: {
            type: 'object',
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
        type: { type: 'string', enum: ['env'] },
        variables: {
            type: 'object',
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
            additionalProperties: {
                type: 'object',
                additionalProperties: {
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
        }
    },
    additionalProperties: false
};

export const TestSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['test'] },
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        import: {
            type: 'object',
            additionalProperties: { type: 'string' }
        },
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
        },
        outputs: {
            type: 'object',
            additionalProperties: {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'null' }
                ]
            }
        },
        steps: {
            type: 'array',
            items: {
                anyOf: [
                    // call step
                    {
                        type: 'object',
                        required: ['call'],
                        properties: {
                            call: { type: 'string' },
                            id: { type: 'string' },
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
                    },
                    // data step
                    {
                        type: 'object',
                        required: ['data'],
                        properties: {
                            data: { type: 'string' }
                        },
                        additionalProperties: false
                    },
                    // check step
                    {
                        type: 'object',
                        required: ['check'],
                        properties: {
                            check: { type: 'string' }
                        },
                        additionalProperties: false
                    },
                    // assert step
                    {
                        type: 'object',
                        required: ['assert'],
                        properties: {
                            assert: { type: 'string' }
                        },
                        additionalProperties: false
                    },
                    // if step
                    {
                        type: 'object',
                        required: ['if', 'steps'],
                        properties: {
                            if: { type: 'string' },
                            steps: { $ref: '#/properties/steps' },
                        },
                        additionalProperties: false
                    },
                    // for step
                    {
                        type: 'object',
                        required: ['for', 'steps'],
                        properties: {
                            for: { type: 'string' },
                            steps: { $ref: '#/properties/steps' }
                        },
                        additionalProperties: false
                    },
                    // repeat step
                    {
                        type: 'object',
                        required: ['repeat', 'steps'],
                        properties: {
                            repeat: { type: ['integer', 'string', 'boolean', 'object', 'array', 'null'] },
                            steps: { $ref: '#/properties/steps' }
                        },
                        additionalProperties: false
                    },
                    // delay step
                    {
                        type: 'object',
                        required: ['delay'],
                        properties: {
                            delay: {
                                anyOf: [
                                    { type: 'integer' },
                                    { type: 'number' },
                                    { type: 'string' }
                                ]
                            }
                        },
                        additionalProperties: false
                    },
                    // js step
                    {
                        type: 'object',
                        required: ['js'],
                        properties: {
                            js: { type: 'string' }
                        },
                        additionalProperties: false
                    },
                    // print step
                    {
                        type: 'object',
                        required: ['print'],
                        properties: {
                            print: { type: 'string' }
                        },
                        additionalProperties: false
                    },
                    // set step
                    {
                        type: 'object',
                        required: ['set'],
                        properties: {
                            set: {
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
                    },
                    // var step
                    {
                        type: 'object',
                        required: ['var'],
                        properties: {
                            var: {
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
                    },
                    {
                        type: 'object',
                        required: ['const'],
                        properties: {
                            const: {
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
                    },
                    {
                        type: 'object',
                        required: ['let'],
                        properties: {
                            let: {
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
                ]
            }
        },
        stages: {
            type: 'array',
            items: {
                type: 'object',
                required: ['stage', 'steps'],
                properties: {
                    stage: { type: 'string' },
                    depends_on: {
                        anyOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ]
                    },
                    condition: { type: 'string' },
                    steps: { $ref: '#/properties/steps' }
                },
                additionalProperties: false
            }
        }
    },
    additionalProperties: false,
    // Allow either steps or stages or both at the root
    anyOf: [
        { required: ['steps'] },
        { required: ['stages'] }
    ]
};