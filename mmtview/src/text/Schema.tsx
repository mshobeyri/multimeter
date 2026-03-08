export const GeneralSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['api', 'env', 'var', 'test', 'suite', 'doc', 'server', 'report'] },
    }
}

export const SuiteSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'tests'],
    properties: {
        type: { type: 'string', enum: ['suite'] },
        title: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        tests: {
            type: 'array',
            items: {
                anyOf: [
                    { type: 'string' }
                ]
            }
        }
    },
    additionalProperties: false
};

export const APISchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'url'],
    properties: {
        type: { type: 'string', enum: ['api'] },
        title: { type: 'string' },
        description: { type: 'string' },
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
                    { type: 'object' },
                    { type: 'array' },
                    { type: 'null' }
                ]
            }
        },
        outputs: {
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
                                { type: 'object' },
                                { type: 'array' },
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
                                { type: 'object' },
                                { type: 'array' },
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
                },
                required: ['method']
            },
            then: {
                required: ['body']
            }
        },
        {
            if: {
                required: ['body']
            },
            then: {
                required: ['format']
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
                                { type: 'object' },
                                { type: 'array' },
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
                            { type: 'object' },
                            { type: 'array' },
                            { type: 'null' }
                        ]
                    }
                }
            }
        },
        certificates: {
            type: 'object',
            properties: {
                ca: {
                    type: 'object',
                    properties: {
                        paths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Paths to CA certificate files'
                        }
                    },
                    additionalProperties: false
                },
                clients: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Certificate name' },
                            host: { type: 'string', description: 'Host pattern (e.g., *.example.com)' },
                            cert_path: { type: 'string', description: 'Path to client certificate' },
                            key_path: { type: 'string', description: 'Path to private key' },
                            passphrase_plain: { type: 'string', description: 'Plain text passphrase' },
                            passphrase_env: { type: 'string', description: 'Environment variable for passphrase' }
                        },
                        additionalProperties: false
                    }
                }
            },
            additionalProperties: false
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
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        import: {
            type: 'object',
            description: 'Alias -> import path. Supports .mmt (test/api/csv) and JS helper modules (.js/.cjs/.mjs).',
            additionalProperties: { type: 'string' }
        },
        inputs: {
            type: 'object',
            additionalProperties: {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'object' },
                    { type: 'array' },
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
                    { type: 'object' },
                    { type: 'array' },
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
                            title: { type: 'string' },
                            inputs: {
                                type: 'object',
                                additionalProperties: {
                                    anyOf: [
                                        { type: 'string' },
                                        { type: 'number' },
                                        { type: 'boolean' },
                                        { type: 'object' },
                                        { type: 'array' },
                                        { type: 'null' }
                                    ]
                                }
                            },
                            check: {
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } }
                                ]
                            },
                            assert: {
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } }
                                ]
                            },
                            report: {
                                oneOf: [
                                    { type: 'string', enum: ['all', 'fails', 'none'] },
                                    {
                                        type: 'object',
                                        properties: {
                                            internal: { type: 'string', enum: ['all', 'fails', 'none'] },
                                            external: { type: 'string', enum: ['all', 'fails', 'none'] }
                                        },
                                        additionalProperties: false
                                    }
                                ]
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
                            check: {
                                oneOf: [
                                    { type: 'string' },
                                    {
                                        type: 'object',
                                        required: ['actual', 'expected'],
                                        properties: {
                                            actual: {},
                                            expected: {},
                                            operator: {
                                                type: 'string',
                                                enum: ['<', '>', '<=', '>=', '==', '!=', '=@', '!@', '=~', '!~', '=^', '!^', '=$', '!$']
                                            },
                                            title: { type: 'string' },
                                            details: { type: 'string' },
                                            report: {
                                                oneOf: [
                                                    { type: 'string', enum: ['all', 'fails', 'none'] },
                                                    {
                                                        type: 'object',
                                                        properties: {
                                                            internal: { type: 'string', enum: ['all', 'fails', 'none'] },
                                                            external: { type: 'string', enum: ['all', 'fails', 'none'] }
                                                        },
                                                        additionalProperties: false
                                                    }
                                                ]
                                            },
                                        },
                                        additionalProperties: false
                                    }
                                ]
                            }
                        },
                        additionalProperties: false
                    },
                    // assert step
                    {
                        type: 'object',
                        required: ['assert'],
                        properties: {
                            assert: {
                                oneOf: [
                                    { type: 'string' },
                                    {
                                        type: 'object',
                                        required: ['actual', 'expected'],
                                        properties: {
                                            actual: {},
                                            expected: {},
                                            operator: {
                                                type: 'string',
                                                enum: ['<', '>', '<=', '>=', '==', '!=', '=@', '!@', '=~', '!~', '=^', '!^', '=$', '!$']
                                            },
                                            title: { type: 'string' },
                                            details: { type: 'string' },
                                            report: {
                                                oneOf: [
                                                    { type: 'string', enum: ['all', 'fails', 'none'] },
                                                    {
                                                        type: 'object',
                                                        properties: {
                                                            internal: { type: 'string', enum: ['all', 'fails', 'none'] },
                                                            external: { type: 'string', enum: ['all', 'fails', 'none'] }
                                                        },
                                                        additionalProperties: false
                                                    }
                                                ]
                                            },
                                        },
                                        additionalProperties: false
                                    }
                                ]
                            }
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
                    // run step (start a mock server)
                    {
                        type: 'object',
                        required: ['run'],
                        properties: {
                            run: { type: 'string' }
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
                                        { type: 'object' },
                                        { type: 'array' },
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
                                        { type: 'object' },
                                        { type: 'array' },
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
                                        { type: 'object' },
                                        { type: 'array' },
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
                                        { type: 'object' },
                                        { type: 'array' },
                                        { type: 'null' }
                                    ]
                                }
                            }
                        },
                        additionalProperties: false
                    },
                    {
                        type: 'object',
                        required: ['setenv'],
                        properties: {
                            setenv: {
                                type: 'object',
                                additionalProperties: {
                                    anyOf: [
                                        { type: 'string' },
                                        { type: 'number' },
                                        { type: 'boolean' },
                                        { type: 'object' },
                                        { type: 'array' },
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
                required: ['id', 'steps'],
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    condition: { type: 'string' },
                    depends_on: {
                        anyOf: [
                            { type: 'string' },
                            { type: 'array', items: { type: 'string' } }
                        ]
                    },
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

export const MockSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type', 'port', 'endpoints'],
    properties: {
        type: { type: 'string', enum: ['server'] },
        title: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        protocol: { type: 'string', enum: ['http', 'https', 'ws'] },
        port: { type: 'number', minimum: 1, maximum: 65535 },
        tls: {
            type: 'object',
            properties: {
                cert: { type: 'string' },
                key: { type: 'string' },
                ca: { type: 'string' },
                requestCert: { type: 'boolean' }
            },
            required: ['cert', 'key'],
            additionalProperties: false
        },
        cors: { type: 'boolean' },
        delay: { type: 'number', minimum: 0 },
        headers: { type: 'object', additionalProperties: { type: 'string' } },
        endpoints: {
            type: 'array',
            items: {
                type: 'object',
                required: ['path'],
                properties: {
                    method: { type: 'string', enum: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] },
                    path: { type: 'string' },
                    name: { type: 'string' },
                    match: {
                        type: 'object',
                        properties: {
                            body: { type: 'object' },
                            headers: { type: 'object', additionalProperties: { type: 'string' } },
                            query: { type: 'object', additionalProperties: { type: 'string' } }
                        },
                        additionalProperties: false
                    },
                    status: { type: 'number', minimum: 100, maximum: 599 },
                    format: { type: 'string', enum: ['json', 'xml', 'text'] },
                    headers: { type: 'object', additionalProperties: { type: 'string' } },
                    body: {},
                    delay: { type: 'number', minimum: 0 },
                    reflect: { type: 'boolean' }
                },
                additionalProperties: false
            }
        },
        proxy: { type: 'string' },
        fallback: {
            type: 'object',
            properties: {
                status: { type: 'number' },
                format: { type: 'string', enum: ['json', 'xml', 'text'] },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
                body: {}
            },
            additionalProperties: false
        }
    },
    additionalProperties: false
};

export const ReportSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['report'] },
        name: { type: 'string' },
        timestamp: { type: 'string' },
        duration: { type: 'string' },
        cancelled: { type: 'boolean' },
        summary: {
            type: 'object',
            properties: {
                tests: { type: 'integer' },
                passed: { type: 'integer' },
                failed: { type: 'integer' },
                errors: { type: 'integer' },
                skipped: { type: 'integer' }
            },
            additionalProperties: false
        },
        suites: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    file: { type: 'string' },
                    duration: { type: 'string' },
                    result: { type: 'string' },
                    tests: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string' },
                                result: { type: 'string' },
                                duration: { type: 'string' },
                                failure: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        actual: {},
                                        expected: {},
                                        operator: { type: 'string' }
                                    },
                                    additionalProperties: false
                                }
                            },
                            additionalProperties: false
                        }
                    }
                },
                additionalProperties: false
            }
        }
    },
    additionalProperties: false
};

export const DocSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', enum: ['doc'] },
        title: { type: 'string' },
        description: { type: 'string' },
        logo: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        services: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    sources: { type: 'array', items: { type: 'string' } }
                },
                additionalProperties: false
            }
        },
        html: {
            type: 'object',
            properties: {
                triable: { type: 'boolean' },
                cors_proxy: { type: 'string' }
            },
            additionalProperties: false
        },
        env: {
            type: 'object',
            additionalProperties: { type: 'string' }
        }
    },
    additionalProperties: false
};