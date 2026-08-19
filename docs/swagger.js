const swaggerJsdoc = require('swagger-jsdoc');

const PORT = process.env.PORT || 3005;

// Shared pieces live here, not in the route comments — an endpoint only says
// "$ref: Task" so a schema change is one edit instead of eight.
const components = {
    securitySchemes: {
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Paste the token from `POST /auth/login` (without the "Bearer " prefix)'
        }
    },

    schemas: {
        Task: {
            type: 'object',
            properties: {
                _id: { type: 'string', example: '6a733d77aae10fd99b9525ed' },
                title: { type: 'string', example: 'Buy milk' },
                description: { type: 'string', example: 'Two litres, semi-skimmed' },
                status: {
                    type: 'string',
                    enum: ['not-started', 'pending', 'in-progress', 'completed'],
                    default: 'not-started'
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    default: 'low'
                },
                dueDate: { type: 'string', format: 'date-time', nullable: true },
                startReminder: { type: 'string', format: 'date-time', nullable: true },
                tags: { type: 'array', items: { type: 'string' }, example: ['errands'] },
                attachments: { type: 'array', items: { type: 'string' } },
                comments: { type: 'array', items: { type: 'string' } },
                subTasks: { type: 'array', items: { type: 'string' } },
                parentTask: { type: 'string', nullable: true },
                userId: {
                    type: 'string',
                    description: 'Owner — taken from the JWT, never from the request body',
                    example: '6a7b242f3b7877edcc1769e4'
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
            }
        },

        TaskInput: {
            type: 'object',
            required: ['title', 'description'],
            description:
                'Unknown fields are rejected with a 400 rather than silently dropped, so a typo like "prioriy" is reported.',
            properties: {
                title: { type: 'string', minLength: 3, maxLength: 100, example: 'Buy milk' },
                description: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 1000,
                    example: 'Two litres, semi-skimmed'
                },
                status: {
                    type: 'string',
                    enum: ['not-started', 'pending', 'in-progress', 'completed'],
                    description: 'Case and spacing are normalised — "In Progress" becomes "in-progress"'
                },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                dueDate: {
                    type: 'string',
                    format: 'date',
                    description: 'Cannot be in the past',
                    example: '2026-12-31'
                },
                startReminder: {
                    type: 'string',
                    format: 'date',
                    description: 'Cannot be in the past, and must be before dueDate'
                },
                tags: {
                    type: 'array',
                    items: { type: 'string', maxLength: 30 },
                    maxItems: 20,
                    description: 'Trimmed; duplicates removed'
                },
                attachments: {
                    type: 'array',
                    items: { type: 'string', maxLength: 300 },
                    maxItems: 10,
                    description: 'Trimmed; duplicates removed'
                },
                comments: {
                    type: 'array',
                    items: { type: 'string', maxLength: 500 },
                    maxItems: 50
                },
                subTasks: {
                    type: 'array',
                    items: { type: 'string', maxLength: 200 },
                    maxItems: 50
                },
                parentTask: { type: 'string', minLength: 1, maxLength: 100 }
            }
        },

        RegisterRequest: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' },
                password: { type: 'string', format: 'password', example: 'secret123' },
                role: {
                    type: 'string',
                    enum: ['admin', 'user', 'manager'],
                    default: 'user'
                }
            }
        },

        LoginRequest: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email', example: 'user@example.com' },
                password: { type: 'string', format: 'password', example: 'secret123' }
            }
        },

        AuthUser: {
            type: 'object',
            description: 'Never includes the password hash',
            properties: {
                id: { type: 'string', example: '6a7b242f3b7877edcc1769e4' },
                email: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', example: 'user' }
            }
        },

        FieldError: {
            type: 'object',
            properties: {
                field: { type: 'string', example: 'title' },
                message: {
                    type: 'string',
                    example: 'title must be a string between 3 and 100 characters'
                }
            }
        },

        Error: {
            type: 'object',
            description: 'Shape returned by every failure — see utils/AppError.js',
            properties: {
                success: { type: 'boolean', example: false },
                status: { type: 'integer', example: 404 },
                message: { type: 'string', example: 'Task not found' },
                code: {
                    type: 'string',
                    description: 'Stable machine contract. Do not parse message — it may change. Unknown bugs are ERR_INTERNAL.',
                    example: 'ERR_TASK_NOT_FOUND'
                },
                errors: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/FieldError' },
                    description: 'Present only when there is per-field detail'
                }
            }
        }
    },

    parameters: {
        TaskId: {
            name: 'id',
            in: 'path',
            required: true,
            description:
                'MongoDB ObjectId. A malformed id is rejected with 400 before the query reaches the database.',
            schema: { type: 'string', example: '6a733d77aae10fd99b9525ed' }
        }
    },

    responses: {
        ValidationFailed: {
            description: 'Invalid input — unknown field, bad value, or malformed id',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                    example: {
                        success: false,
                        status: 400,
                        message: 'Validation failed',
                        code: 'ERR_VALIDATION',
                        errors: [
                            { field: 'title', message: 'title must be a string between 3 and 100 characters' },
                            { field: 'description', message: 'description is required' }
                        ]
                    }
                }
            }
        },
        Unauthorized: {
            description: 'Missing, expired or invalid token',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                    example: { success: false, status: 401, message: 'Not authorized, no token', code: 'ERR_NO_TOKEN' }
                }
            }
        },
        NotFound: {
            description: 'No task with that id belongs to the authenticated user',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                    example: { success: false, status: 404, message: 'Task not found', code: 'ERR_TASK_NOT_FOUND' }
                }
            }
        },
        TooManyRequests: {
            description: 'Rate limit exceeded — see the RateLimit-* response headers',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                    example: {
                        success: false,
                        status: 429,
                        message: 'Too many requests, please try again later',
                        code: 'ERR_RATE_LIMIT'
                    }
                }
            }
        },
        ServerError: {
            description: 'Unexpected error — details are logged server-side, never returned',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                    example: { success: false, status: 500, message: 'Something went wrong', code: 'ERR_INTERNAL' }
                }
            }
        }
    }
};

const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'Todo API',
            version: '1.0.0',
            description: [
                'Task manager with JWT auth. Every task is scoped to its owner, so one user can never read or modify another user\'s tasks.',
                '',
                '**Errors** all share one shape: `{ success, status, message, code, errors? }`. `code` is the stable contract (e.g. `ERR_TASK_NOT_FOUND`); do not parse `message`.',
                '',
                '**To try a protected endpoint:** call `POST /auth/register`, then `POST /auth/login`, copy the `token`, and paste it into **Authorize** above.'
            ].join('\n')
        },
        servers: [
            {
                url: `http://localhost:${PORT}/api/v1`,
                description: 'Local development (v1)'
            }
        ],
        tags: [
            { name: 'Auth', description: 'Register and login — public, strictly rate limited' },
            { name: 'Tasks', description: 'Task CRUD — all endpoints require a Bearer token' }
        ],
        components,
        // applied to every operation; auth routes opt out with `security: []`
        security: [{ bearerAuth: [] }]
    },
    // paths are declared relative to the server url above, so route files stay
    // unaware of the /api/v1 prefix — same reason routes/v1.js owns the mount
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);
